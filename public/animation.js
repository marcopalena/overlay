/************************************************************************************************************************************
                                                   ANIMATION COMPOSITION FUNCTIONS
************************************************************************************************************************************/

function footerFadeIn() {
    var footer = $("#footer");
    var phaseTextContainer = $('#phase-text-container');
    var tl_footer_fadein = new TimelineMax();
    tl_footer_fadein.fromTo([footer, phaseTextContainer], 0.5,  { y : 0, autoAlpha: 0}, { y : -390, autoAlpha: 1});
    return [tl_footer_fadein];
}

// Makes the Ludosport logo appear
function logoFadeIn() {

  // Get ludosport logo components
  var frame_central_arena = $("#frame-central-arena");
  var frame_central_arena_shadow_clip = $("#frame-central-arena-shadow-clip");
  var frame_central_blade = $("#frame-central-blade");
  var frame_central_blade_shadow_clip = $("#frame-central-blade-shadow-clip");
  var frame_lateral_wings = $('#frame-lateral-wings');

  // Create logo fade in timeline
  var tl_logo_fadein = new TimelineMax();

  // Perform logo fade in
  tl_logo_fadein.fromTo([frame_central_arena, frame_central_arena_shadow_clip, frame_central_blade, frame_central_blade_shadow_clip, frame_lateral_wings], 1.5, {autoAlpha: 0, scale: 0, ease: Back.easeOut}, {autoAlpha: 1, scale: 1, ease: Back.easeOut});
  return [tl_logo_fadein];
}

// Animates the bottom part of the Ludosport logo: it is flipped and morphed it into the central arena part of the frame
function logoBottomToArena() {

  // Get frame central arena SVG element
  var frame_central_arena = $("#frame-central-arena");
  var frame_central_arena_shadow_clip = $("#frame-central-arena-shadow-clip");

  // Get path elements to morph
  var start_black = $("#frame-central-arena-start").find('.frame-central-arena-black');
  var start_darkgray = $("#frame-central-arena-start").find('.frame-central-arena-darkgray');
  var start_lightgray = $("#frame-central-arena-start").find('.frame-central-arena-lightgray');
  var start_white = $("#frame-central-arena-start").find('.frame-central-arena-white');
  var start_white_shadow_clip = $("#frame-central-arena-start-shadow-clip").find('.frame-central-arena-white-shadow-clip');
  var end_black = $("#frame-central-arena-end").find('.frame-central-arena-black');
  var end_darkgray = $("#frame-central-arena-end").find('.frame-central-arena-darkgray');
  var end_lightgray = $("#frame-central-arena-end").find('.frame-central-arena-lightgray');
  var end_white = $("#frame-central-arena-end").find('.frame-central-arena-white');
  var end_white_shadow_clip = $("#frame-central-arena-end-shadow-clip").find('.frame-central-arena-white-shadow-clip');

  // Create timelines to handle five contemporary animations: 4 path morphs and a vertical flip
  var tl_flip = new TimelineMax({repeatDelay: 0.2});
  var tl_shadow_clip_flip = new TimelineMax({repeatDelay: 0.2});
  var tl_black_morph = new TimelineMax();
  var tl_darkgray_morph = new TimelineMax();
  var tl_lightgray_morph = new TimelineMax();
  var tl_white_morph = new TimelineMax();
  var tl_white_shadow_clip_morph = new TimelineMax();

  // Perform vertical flip
  TweenMax.set(frame_central_arena, {transformStyle:"preserve-3d"});
  tl_flip.to(frame_central_arena, 1.8, {rotationX: -180, transformOrigin:"50% 46.6%", ease: Power3.easeOut}); //y:"-=48.9"
  tl_shadow_clip_flip.to(frame_central_arena_shadow_clip, 1.8, {rotationX: -180, transformOrigin:"50% 46.6%", ease: Power3.easeOut});

  // Perform paths morphing
  tl_black_morph.to(start_black, 2, {morphSVG:{shape: end_black, shapeIndex: -3}, ease: Back.easeOut});
  tl_darkgray_morph.to(start_darkgray, 2, {morphSVG:{shape: end_darkgray, shapeIndex: -3}, ease: Back.easeOut});
  tl_lightgray_morph.to(start_lightgray, 2, {morphSVG:{shape: end_lightgray, shapeIndex: -3}, ease: Back.easeOut});
  tl_white_morph.to(start_white, 2, {morphSVG:{shape: end_white, shapeIndex: -3}, ease: Back.easeOut});
  tl_white_shadow_clip_morph.to(start_white_shadow_clip, 2, {morphSVG:{shape: end_white_shadow_clip, shapeIndex: -3}, ease: Back.easeOut});

  // Nest timelines into a single central frame timeline
  return [tl_flip, tl_black_morph, tl_darkgray_morph, tl_lightgray_morph, tl_white_morph, tl_shadow_clip_flip, tl_white_shadow_clip_morph];
}

// Animates the top part of the Ludosport logo: it is scaled to become the central blade part of the frame
function logoTopToBlade() {

  // Get frame central blade SVG element and its shadow clipping element
  var frame_central_blade = $("#frame-central-blade");
  var frame_central_blade_shadow_clip = $("#frame-central-blade-shadow-clip");


  // Create timelines to handle blade scaling
  var tl_blade = new TimelineMax();
  var tl_blade_shadow_clip = new TimelineMax();

  // Perform scaling
  tl_blade.to(frame_central_blade, 2, {scale: 0.320322199, y: -273.0812, transformOrigin:"50% 50%", ease: Back.easeOut});
  tl_blade_shadow_clip.to(frame_central_blade_shadow_clip, 2, {scale: 0.330322199, y: -273.0812, transformOrigin:"50% 50%", ease: Back.easeOut});

  // Return blade timeline
  return [tl_blade, tl_blade_shadow_clip];
}

// Animates the sides of the Ludosport logo: first they are scaled them and shifted upwards along with the rest of the logo, then they part outwards
// to reveal the rest of the frame and the name and schools of the contenders
function logoSidesToLateralWings() {

  // Get frame lateral wings SVG elements
  var frame_lateral_wings = $('#frame-lateral-wings');
  var frame_lateral_wings_container = $('#frame-lateral-wings-container');
  var frame_lateral_wing_left = $('#frame-lateral-wings-left');
  var frame_lateral_wing_right = $('#frame-lateral-wings-right');
  var frame_bottom_mask = $('#frame-bottom-mask-rect');
  var frame_bottom_shadow_clip_mask = $('#frame-bottom-shadow-clip-mask-rect');
  var frame_background = $('#frame-background');
  var frame_top_mask = $('#frame-top-mask-rect');
  var frame_top_mask_left = $('#frame-top-mask-rect-left');
  var frame_top_mask_right = $('#frame-top-mask-rect-right');
  var frame_bottom_mask_left = $('#frame-bottom-mask-rect-left');
  var frame_bottom_mask_right = $('#frame-bottom-mask-rect-right');
  var text_mask = $('#text-mask-rect');

  // Create timelines to handle wings scaling, rotation and movement
  //var tl_scale_wings = new TimelineMax();
  var tl_rotate_wings =  new TimelineMax();
  var tl_wing_left =  new TimelineMax();
  var tl_wing_right =  new TimelineMax();
  var tl_scale_wings = new TimelineMax();
  var tl_reveal_bottom = new TimelineMax();
  var tl_reveal_top = new TimelineMax();
  var tl_reveal_adjust_left = new TimelineMax();
  var tl_reveal_adjust_right = new TimelineMax();
  var tl_reveal_background = new TimelineMax();

  // Perform logo sides animation and frame revealing
  TweenMax.set(frame_lateral_wings, {transformStyle:"preserve-3d"});
  tl_scale_wings.to(frame_lateral_wings_container, 2, {scale: 0.4, y:-390.683334351, transformOrigin:"50% 50%", ease: Back.easeOut});
  //tl_rotate_wings.to(frame_lateral_wings, 3, {rotationY: 360, ease: SlowMo.easeOut});
  tl_wing_left.to(frame_lateral_wing_left, 1.6, {scaleY: 1.78415, scaleX:2.36877, x: 1456.641616821, y:-50.36481339, transformOrigin:"50% 50%", delay: 1.3, ease: Power2.easeIn});
  tl_wing_right.to(frame_lateral_wing_right, 1.6, {scaleY: 1.78415, scaleX:2.36875, x: -1456.641616821, y:-50.36481339, transformOrigin:"50% 50%", delay: 1.3, ease: Power2.easeIn});
  tl_reveal_bottom.to([frame_bottom_mask, frame_bottom_shadow_clip_mask], 1.68, {attr: {width:1280}, x: -640, delay: 1.3, ease: Power2.easeIn});
  tl_reveal_top.to([frame_top_mask, text_mask], 1.68, {attr: {width:1280}, x: -640, delay: 1.3, ease: Power2.easeIn});
  tl_reveal_adjust_left.to([frame_top_mask_left, frame_bottom_mask_left], 1.68, {x: -640, delay: 1.3, ease: Power2.easeIn});
  tl_reveal_adjust_right.to([frame_top_mask_right, frame_bottom_mask_right], 1.68, {x: 640, delay: 1.3, ease: Power2.easeIn});
  tl_reveal_background.to(frame_background, 2.7, {css : {maskPosition: "0% 0", WebkitMaskPosition: "0% 0"}, ease: SteppedEase.config(74), delay: 1.8});

  // Return the logo wings timelines
  return [tl_scale_wings, tl_rotate_wings, tl_wing_left, tl_wing_right, tl_reveal_bottom, tl_reveal_top, tl_reveal_background, tl_reveal_adjust_left, tl_reveal_adjust_right];
}

// Fill in the frame's last pieces of information: the academies logos fade in, the timer slides in, the score and versus text fades in, the assaults
// markers pops out and the form icons appears
function fillInFrameInfo(useAssaults) {

  // Get last components to animate
  var academies = $('#academies');
  var scores = $('#scores');
  var versus = $('#versus');
  var assaults = $('.assault');
  var timer = $('#timer-inner');
  var right_contender_forms = $('#right-contender-forms').find('.form-icon.active');
  var left_contender_forms = $('#left-contender-forms').find('.form-icon.active');
  var odd_forms = $.merge(right_contender_forms.filter(":odd"), left_contender_forms.filter(":odd"));
  var even_forms = $.merge(right_contender_forms.filter(":even"), left_contender_forms.filter(":even"));

  let formIds = [];
  $.each(left_contender_forms, function(index, value) {
      formIds.push($(this).data('form-id'));
  });
  console.log("Active left forms: " + formIds);
  formIds = [];
  $.each(right_contender_forms, function(index, value) {
      formIds.push($(this).data('form-id'));
  });
  console.log("Active right forms: " + formIds);

  // Create timelines to complete animation
  var tl_academies_fadein = new TimelineMax();
  var tl_duel_info_fadein = new TimelineMax();
  var tl_assaults_pop_out = new TimelineMax();
  var tl_timer_fade_in = new TimelineMax();
  var tl_forms_fade_left = new TimelineMax();
  var tl_forms_fade_right = new TimelineMax();

  // Perform final touches to the animation
  //TweenMax.set(even_forms, {rotation: 180, transformOrigin: "50% 50%", opacity: 0, y:"-=10"});
  //TweenMax.set(odd_forms, {rotation: -180, transformOrigin: "50% 50%", opacity: 0, y:"+=10"});
  TweenMax.set(assaults, {scale:0, opacity: 0, transformOrigin: "50% 50%"});
  tl_academies_fadein.fromTo([academies], 0.7, {autoAlpha: 0}, {autoAlpha: 1});
  tl_duel_info_fadein.fromTo([scores, versus, assaults], 0.7, {autoAlpha: 0}, {autoAlpha: 1});
  tl_assaults_pop_out.staggerTo(assaults, 0.7, {scale: useAssaults ? 1 : 0, opacity: useAssaults ? 1 : 0, transformOrigin: "50% 50%"}, 0.15);
  tl_timer_fade_in.fromTo(timer, 1, {autoAlpha:0, attr: {startOffset: "5%"}, scale : 0, ease:Elastic.easeOut.config(1, 0.5), delay: 0.35}, {autoAlpha:1, attr: {startOffset: "0%"}, scale : 1});

  /*tl_forms_fade_left.staggerFromTo(left_contender_forms, 0.7,
    {
      opacity: 0,
      rotation: function (index, target) {
        if($.inArray(target, even_forms) != -1) return 180;
        else return -180;
      },
      y: function (index, target) {
        if($.inArray(target, even_forms) != -1) return "-=10";
        else return "+=10";
      },
      transformOrigin: "50% 50%"
    },
    {
      opacity: 1,
      rotation: 0,
      y: 0,
      transformOrigin: "50% 50%",
      ease:Elastic.easeOut.config(1, 0.5),
      delay: 0.4
    }, 0.15);
  tl_forms_fade_right.staggerFromTo(right_contender_forms, 0.7,
    {
      opacity: 0,
      rotation: function (index, target) {
        if($.inArray(target, even_forms) != -1) return 180;
        else return -180;
      },
      y: function (index, target) {
        if($.inArray(target, even_forms) != -1) return -10;
        else return 10;
      },
      transformOrigin: "50% 50%"
    },
    {
      opacity: 1,
      rotation: 0,
      y: 0,
      transformOrigin: "50% 50%",
      ease:Elastic.easeOut.config(1, 0.5),
      delay: 0.4
  }, 0.15);*/

  // Return the final touches timelines
  return [tl_academies_fadein, tl_duel_info_fadein, tl_assaults_pop_out, tl_timer_fade_in, tl_forms_fade_left, tl_forms_fade_right];
}

/************************************************************************************************************************************
                                                      ANIMATION CONTROL FUNCTIONS
************************************************************************************************************************************/

function pauseFightFrameOverlayAnimation() {
  console.log("Paused");
  fightFrameOverlayAnimation.pause();
}

// Shows the fight frame overlay (either with or without animation)
function showFightFrameOverlay(useAnimation=true, onComplete=null) {

  // Show fight frame overlay playing the animation
  if(useAnimation === true) {
    fightFrameOverlayAnimation.eventCallback("onComplete", null);
    fightFrameOverlayAnimation.eventCallback("onComplete", function() {
      onComplete();
      pauseFightFrameOverlayAnimation();
    });
    fightFrameOverlayAnimation.play();
    footerOverlayAnimation.play();
  }

  // Show fight frame overlay without playing the animation
  else {
    unhideFightFrameComponents();
    var duration = fightFrameOverlayAnimation.duration();
    fightFrameOverlayAnimation.seek(duration, true);
    duration = footerOverlayAnimation.duration();
    footerOverlayAnimation.seek(duration, true);
    if(onComplete) onComplete();
  }
}

// Hides the fight frame overlay (either with or without animation)
function closeOpenFightFrameOverlay(onClose=null, onOpen=null) {
    TweenMax.to(fightFrameOverlayAnimation, 2.3, { progress : 0.5, onComplete: function () {
        if(onClose) onClose();
    }});
    TweenMax.to(fightFrameOverlayAnimation, 2.3, { progress : 1, delay: 2.4, onComplete: function() {
        if (onOpen) onOpen();
    }});
}

function hideFightFrameOverlay(useAnimation=true, onComplete=null) {

    // Hide fight frame overlay playing the animation
    if(useAnimation) {
        fightFrameOverlayAnimation.eventCallback("onReverseComplete", null);
        fightFrameOverlayAnimation.eventCallback("onReverseComplete", function() {
            onComplete();
            pauseFightFrameOverlayAnimation();
        });
        fightFrameOverlayAnimation.reverse();
        footerOverlayAnimation.reverse();
    }

    // Hide fight frame overlay without playing the animation
    else {
        fightFrameOverlayAnimation.seek(0, true);
        footerOverlayAnimation.seek(0, true);
        hideFightFrameComponents();
        if(onComplete) onComplete();
    }
}


/************************************************************************************************************************************
                                                   ANIMATION INITIALIZATION
************************************************************************************************************************************/

// Unhide frame components that are set as initially hidden (this is done in order to prevent them from flashing briefly on the page
// before the animation gets fully initialized)
function unhideFightFrameComponents() {
    $('#frame-central-arena').css("display", "inline");
    $('#frame-central-blade').css("display", "inline");
    $('#frame-central-blade-shadow-clip').css("display", "inline");
    $('#frame-central-arena-shadow-clip').css("display", "inline");
    $('#frame-lateral-wings').css("display", "inline");
    $('#info').css("display", "block");
    $('#scores').css("display", "inline");
    $('#versus').css("display", "inline");
    $('#timer-container').css("display", "inline");
    $('#assaults').css("display", "block");
    $('#academies').css("display", "inline");
}

// Hide frame components that were set as initially hidden
function hideFightFrameComponents() {
    $('#frame-central-arena').css("display", "none");
    $('#frame-central-blade').css("display", "none");
    $('#frame-central-blade-shadow-clip').css("display", "none");
    $('#frame-central-arena-shadow-clip').css("display", "none");
    $('#frame-lateral-wings').css("display", "none");
    $('#info').css("display", "block");
    $('#scores').css("display", "none");
    $('#versus').css("display", "none");
    $('#timer-container').css("display", "none");
    $('#assaults').css("display", "block");
    $('#academies').css("display", "none");
}

// Define main timeline of the animation
var fightFrameOverlayAnimation = null;
var footerOverlayAnimation = null;

// Define amount of time to wait after and before repeating the animation
var endDelay = 1;
var startDelay = 1;

// Initialize animation
function initializeFightFrameOverlay(useAssaults) {

  // Kill previous animation if present
  if(fightFrameOverlayAnimation) {
    fightFrameOverlayAnimation.kill();
    fightFrameOverlayAnimation = null;
    footerOverlayAnimation.kill();
    footerOverlayAnimation = null;
  }

  // Initialize animation main timeline
  fightFrameOverlayAnimation = new TimelineMax({delay: startDelay, repeat: 0, repeatDelay: endDelay, paused: true, onStart: function() {
    unhideFightFrameComponents();
  }});
  footerOverlayAnimation = new TimelineMax({delay: 6, repeat: 0, repeatDelay: endDelay, paused: true});

  // Compose master timeline
  fightFrameOverlayAnimation.add("start").add(logoFadeIn(), 0)
  fightFrameOverlayAnimation.add(logoBottomToArena(), 1.5).addLabel("partial", "-=3");
  fightFrameOverlayAnimation.add(logoTopToBlade(), 1.5);
  fightFrameOverlayAnimation.add(logoSidesToLateralWings(), 1.5);
  fightFrameOverlayAnimation.add(fillInFrameInfo(useAssaults), 4.7).add("end");
  fightFrameOverlayAnimation.addLabel("partial", "2.5")

  footerOverlayAnimation.add(footerFadeIn(), 0);
}
