/**
 * @require Constants
 * @require Events
 */
$.namespace("pskl");

(function () {

  /**
   * FrameSheetModel instance.
   */
  var frameSheet,

      // Configuration:
      // Canvas size in pixel size (not dpi related)
      framePixelWidth = 32, 
      framePixelHeight = 32,

      // Scaling factors for a given frameSheet rendering:
      // Main drawing area:
      drawingCanvasDpi = 20,   
      // Canvas preview film canvases:
      previewTileCanvasDpi = 4,
      // Animated canvas preview:
      previewAnimationCanvasDpi = 8;

  /**
   * Main application controller
   */
  var piskel = {

    init : function () {
      piskel.initDPIs_();

      frameSheet = new pskl.model.FrameSheet(framePixelWidth, framePixelHeight);
      frameSheet.addEmptyFrame();
      
      this.drawingController = new pskl.controller.DrawingController(
        frameSheet,
        $('#drawing-canvas-container'), 
        drawingCanvasDpi
      );

      this.animationController = new pskl.controller.AnimatedPreviewController(
        frameSheet,
        $('#preview-canvas-container'), 
        previewAnimationCanvasDpi
      );


      this.previewsController = new pskl.controller.PreviewFilmController(
        frameSheet,
        $('#preview-list'), 
        previewTileCanvasDpi
      );

      // To catch the current active frame, the selection manager have to be before
      // the 'frameSheet.setCurrentFrameIndex(0);'
      // TODO(vincz): Slice each constructor to have:
      //                  - an event(s) listening init
      //                  - an event(s) triggering init
      // All listerners will be hook in a first step, then all event triggering inits will be called
      // in a second batch.
      this.selectionManager =
          new pskl.selection.SelectionManager(this.drawingController.overlayFrame);
      
      frameSheet.setCurrentFrameIndex(0);

      

      this.animationController.init();
      this.previewsController.init();

      this.historyManager = new pskl.HistoryManager(frameSheet);
      this.historyManager.init();

      this.keyManager = new pskl.KeyManager();

      pskl.NotificationService.init();
      pskl.LocalStorageService.init(frameSheet);

      // TODO: Add comments 
      var framesheetId = this.getFramesheetIdFromUrl();
      if (framesheetId) {
        $.publish(Events.SHOW_NOTIFICATION, [{"content": "Loading animation with id : [" + framesheetId + "]"}]);
        this.loadFramesheetFromService(framesheetId);
      } else {
        this.finishInit();
        pskl.LocalStorageService.displayRestoreNotification();
      }

      var drawingLoop = new pskl.rendering.DrawingLoop();
      drawingLoop.addCallback(this.render, this);
      drawingLoop.start();
    },

    render : function (delta) {
      this.drawingController.render(delta);
      this.animationController.render(delta);
      this.previewsController.render(delta);
    },

    /**
     * Override default DPIs.
     * @private
     */
    initDPIs_ : function() {
      drawingCanvasDpi = piskel.calculateDPIsForDrawingCanvas_();
      // TODO(vincz): Add throttling on window.resize event.
      $(window).resize($.proxy(function() {
        drawingCanvasDpi = piskel.calculateDPIsForDrawingCanvas_();
        this.drawingController.updateDPI(drawingCanvasDpi);
      }, this));
      // TODO(vincz): Check for user settings eventually from localstorage.
    },

    /**
     * @private
     */
    calculateDPIsForDrawingCanvas_ : function() {
      var availableViewportHeight = $('.main-panel').height() - 50,
          availableViewportWidth = $('.main-panel').width(),
          previewHeight = $(".preview-container").height(),
          previewWidth = $(".preview-container").width();

      var heightBoundDpi = Math.floor(availableViewportHeight / framePixelHeight),
          widthBoundDpi = Math.floor(availableViewportWidth / framePixelWidth);

      var dpi = Math.min(heightBoundDpi, widthBoundDpi);

      var drawingCanvasHeight = dpi * framePixelHeight;
      var drawingCanvasWidth = dpi * framePixelWidth;

      // Check if preview and drawing canvas overlap
      var heightGap =  drawingCanvasHeight + previewHeight - availableViewportHeight,
          widthGap = drawingCanvasWidth + previewWidth - availableViewportWidth;
      if (heightGap > 0 && widthGap > 0) {
          // Calculate the DPI change needed to bridge height and width gap
          var heightGapDpi = Math.ceil(heightGap / framePixelHeight),
          widthGapDpi = Math.ceil(widthGap / framePixelWidth);

          // substract smallest dpi change to initial dpi
          dpi -= Math.min(heightGapDpi, widthGapDpi);
      }
      
      return dpi;
    },

    finishInit : function () {
      pskl.ToolSelector.init();
      pskl.Palette.init(frameSheet);
    },

    getFramesheetIdFromUrl : function() {
      var href = window.location.href;
      // TODO: Change frameId to framesheetId on the backend
      if (href.indexOf('frameId=') != -1) {
        return href.substring(href.indexOf('frameId=')+8);
      }
    },

    loadFramesheetFromService : function (frameId) {
      var xhr = new XMLHttpRequest();
      // TODO: Change frameId to framesheetId on the backend
      xhr.open('GET', Constants.PISKEL_SERVICE_URL + '/get?l=' + frameId, true);
      xhr.responseType = 'text';

      xhr.onload = function(e) {
        frameSheet.deserialize(this.responseText);
        $.publish(Events.HIDE_NOTIFICATION);
        piskel.finishInit();
      };

      xhr.onerror = function () {
        $.publish(Events.HIDE_NOTIFICATION);
        piskel.finishInit();
      };

      xhr.send();
    },

    // TODO(julz): Create package ?
    storeSheet : function (event) {
      // TODO Refactor using jquery ?
      var xhr = new XMLHttpRequest();
      var formData = new FormData();
      formData.append('framesheet_content', frameSheet.serialize());
      formData.append('fps_speed', $('#preview-fps').val());
      xhr.open('POST', Constants.PISKEL_SERVICE_URL + "/store", true);
      xhr.onload = function(e) {
        if (this.status == 200) {
          var baseUrl = window.location.href.replace(window.location.search, "");
          window.location.href = baseUrl + "?frameId=" + this.responseText;
        }
      };

      xhr.send(formData);

      if(event) {
        event.stopPropagation();
        event.preventDefault();
      }
      return false;
    }
  };

  window.piskel = piskel;
  piskel.init();

})();
