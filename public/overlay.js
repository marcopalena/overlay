/************************************************************************************************************************************
                                                            OVERLAY GLOBALS
************************************************************************************************************************************/

// Frame information default positioning
var defaultNamesFontSize = 0;
var defaultSchoolsFontSize = 0;
var defaultFormIconsWidth = 0;
var defaultFormIconsGapsWidth = 0;
var defaultPadding = 0;
var defaultLeftNameWidth = 0;
var defaultLeftSchoolWidth = 0;
var defaultLeftNameHeight = 0;
var defaultRightNameWidth = 0;
var defaultRightSchoolWidth = 0;
var defaultRightNameHeight = 0;
var defaultLeftInfoBox = null;
var defaultRightInfoBox = null;
var defaultStyle = null;

var minNamesFontSize = 25;
var minFormIconsWidth = 18;
var minSchoolsFontSize = 15;
var formIconsScaleFactor = 0.95;
var nameFontSizeScaleFactor = 0.95;
var schoolFontSizeScaleFactor = 0.95;

// Fight overlay frame status
var isFrameShown = false;
var currentStyle = null;
var currentLeftName = null;
var currentDisplayedLeftName = null;
var currentLeftSchool = null;
var currentDisplayedLeftSchool = null;
var currentLeftForms = null;
var currentRightName = null;
var currentDisplayedRightName = null;
var currentRightSchool = null;
var currentDisplayedRightSchool = null;
var currentRightForms = null;
var currentPhase = null;

/************************************************************************************************************************************
                                                  FIGHT FRAME OVERLAY FORMATTING
************************************************************************************************************************************/

function getFormIconsSizes(formIcons) {

    var activeFormIcons = formIcons.find('.active');
    var formIconsWidth = 0;
    var formIconsGapWidth = 0;

    if(activeFormIcons.length > 0) {
        var formIconBox = activeFormIcons.get(0).getBoundingClientRect();
        formIconsWidth = formIconBox.width.toFixed(2);
    }

    if(activeFormIcons.length > 1) {
        var formIconBox1 = activeFormIcons.get(0).getBoundingClientRect();
        var formIconBox2 = activeFormIcons.get(1).getBoundingClientRect();
        var sign = formIconBox2.x > formIconBox1.x;
        formIconsGapWidth = Math.abs(formIconBox2.x - (formIconBox1.x + (sign ? formIconBox1.width : - formIconBox1.width))).toFixed(2)
    }

    return {
        'formWidth' : formIconsWidth,
        'gapWidth' : formIconsGapWidth
    }
}

var formIds = ['1', '2', 'Y', '3', '4', '5', '6', '7', '8', '9'];

function scaleContenderForms(forms, newFormIconsWidth, newFormIconsGapWidth, align="left") {

    // Get current form and gap width
    var formIconsWidth = defaultStyle['formIconsWidth'];
    var formIconsGapWidth = defaultStyle['formIconsGapWidth'];

    // Scale maintaing alignment
    if(align=="right") {
        let j=0;
        for(let i of formIds){

            // Get form icon element and its bounding box
            var formIcon = forms.find('.form' + i);
            var formBox = formIcon.get(0).getBBox();

            // For currently active form icons, compute the horizontal shift due to subsequent
            // form icons being scaled and gaps being adjusted
            var shift = 0;
            if(formIcon.hasClass('active')) {
                j++;
                shift = (j-1)*(newFormIconsWidth - formIconsWidth) + (j-1)*(newFormIconsGapWidth - formIconsGapWidth);
            }

            // Compute scale
            var scaleFactor = newFormIconsWidth / formIconsWidth;

            // Apply trasformations, consisting of:
            //  - Any previous translation due to not all form icons being currently active (currentTransform)
            //  - A translation to move the origin to the middle of the right side (formBox.x plus width instead of width/2)
            //  - A translation taking into account subsequent elements being scaled and preceding gaps being adjusted (-shift)
            //  - A scale operation to perform the actual scaling w.r.t. the vertical center and horizontal right
            //  - A final translation to move the origin back to its original position
            TweenMax.set(formIcon, {transformOrigin: "50% 50%", scale: scaleFactor, x: "-=" + shift});
       }
    } else if(align=="left") {
        let j=0;
        for(let i of formIds){

            // Get form icon element and its bounding box
            var formIcon = forms.find('.form' + i);
            var formBox = formIcon.get(0).getBBox();

            // For currently active form icons, compute the horizontal shift due to precedent
            // form icons being scaled and gaps being adjusted
            var shift = 0;
            if(formIcon.hasClass('active')) {
                j++;
                shift = (j-1)*(newFormIconsWidth - formIconsWidth) + (j-1)*(newFormIconsGapWidth - formIconsGapWidth);
            }

            // Compute scale
            var scaleFactor = newFormIconsWidth / formIconsWidth;

            // Apply trasformations, consisting of:
            //  - Any previous translation due to not all form icons being currently active (currentTransform)
            //  - A translation to move the origin to the middle of the left side (formBox.x plus 0 instead of width/2)
            //  - A translation taking into account preceding elements being scaled and preceding gaps being adjusted (shift)
            //  - A scale operation to perform the actual scaling w.r.t. the vertical center and horizontal left
            //  - A final translation to move the origin back to its original position
            TweenMax.set(formIcon, {transformOrigin: "50% 50%", scale: scaleFactor, x: "+=" + shift});
        }
    }
}

// Returns the padding between the name and the form icons of a contender
function getPadding(text, align="left") {
    var nameBox = text.find('.contender-name-container').get(0).getBBox();
    var formsBox = text.find('.contender-forms').get(0).getBBox();
    if(align == "left") {
        var nameFormsPadding = formsBox.x - (nameBox.x + nameBox.width);
        return Math.round(nameFormsPadding.toFixed(2));
    } else if(align == "right"){
        var nameFormsPadding = nameBox.x - (formsBox.x + formsBox.width);
        return Math.round(nameFormsPadding.toFixed(2));
    }
}

function computeDefaultSizes() {

    // Get left contender sizes
    var leftContenderNameFontSize = $('#left-contender-name').css('font-size');
    var leftContenderSchoolFontSize = $('#left-contender-school').css('font-size');
    var leftContenderFormIconsSizes = getFormIconsSizes($('#left-contender-forms'));
    var leftContenderPadding = getPadding($('#left-contender-text'), align="left");

    // Get right contender components
    var rightContenderNameFontSize = $('#right-contender-name').css('font-size');
    var rightContenderSchoolFontSize = $('#right-contender-school').css('font-size');
    var rightContenderFormIconsSizes = getFormIconsSizes($('#right-contender-forms'));
    var rightContenderPadding = getPadding($('#right-contender-text'), align="right");

    // Assert harmony beteen left and right formatting
    console.assert(leftContenderNameFontSize == rightContenderNameFontSize, "Default name font size mismatch!");
    console.assert(leftContenderSchoolFontSize == rightContenderSchoolFontSize, "Default school font size mismatch!");
    console.assert(leftContenderFormIconsSizes['formWidth'] == rightContenderFormIconsSizes['formWidth'], "Default form icons width mismatch!");
    console.assert(leftContenderFormIconsSizes['gapWidth'] == rightContenderFormIconsSizes['gapWidth'], "Default form icons gap width mismatch!");
    console.assert(Math.abs(leftContenderPadding - rightContenderPadding) <= 2, "Padding between name, separator and form icons mismatch!");

    // Set default sizes
    defaultNamesFontSize = parseInt(leftContenderNameFontSize, 10);
    defaultSchoolsFontSize = parseInt(leftContenderSchoolFontSize, 10);
    defaultFormIconsWidth = parseFloat(leftContenderFormIconsSizes['formWidth']);
    defaultFormIconsGapsWidth = parseFloat(leftContenderFormIconsSizes['gapWidth']);
    defaultPadding = leftContenderPadding;

    // Set default info box dimensions
    var leftInfoBox = $('#left-contender-text').get(0).getBBox();
    var rightInfoBox = $('#right-contender-text').get(0).getBBox();
    var leftContenderNameBox = $('#left-contender-name-container').get(0).getBBox();
    var leftContenderSchoolBox = $('#left-contender-school-container').get(0).getBBox();
    var rightContenderNameBox = $('#right-contender-name-container').get(0).getBBox();
    var rightContenderSchoolBox = $('#right-contender-school-container').get(0).getBBox();
    defaultLeftNameWidth = leftContenderNameBox.width;
    defaultLeftSchoolWidth = leftContenderSchoolBox.width;
    defaultLeftNameHeight = leftContenderNameBox.height;
    defaultRightNameWidth = rightContenderNameBox.width;
    defaultRightSchoolWidth = rightContenderSchoolBox.width;
    defaultRightNameHeight = rightContenderNameBox.height;
    defaultLeftInfoBox = leftInfoBox;
    defaultLeftInfoBox.width = defaultLeftInfoBox.width - 3*defaultFormIconsWidth - 2 * defaultFormIconsGapsWidth;
    defaultRightInfoBox = rightInfoBox;
    defaultRightInfoBox.width = defaultRightInfoBox.width - 3*defaultFormIconsWidth - 2 * defaultFormIconsGapsWidth;

    // Compose default style
    defaultStyle = {
        "nameFontSize" : defaultNamesFontSize,
        "schoolFontSize" : defaultSchoolsFontSize,
        "formIconsWidth" : defaultFormIconsWidth,
        "formIconsGapWidth" : defaultFormIconsGapsWidth
    }
    currentStyle = defaultStyle;
}

var isTimerStarted = false;
function startTimer(){
    if(!isTimerStarted) {
        isTimerStarted = true;
        $('.timer').countimer('start');
    } else {
        resumeTimer();
    }
}

function stopTimer(){
    $('.timer').countimer('stop');
}

function resumeTimer(){
    $('.timer').countimer('resume');
}

function setTimer(min, secs) {
    $('#timer-inner').text("                                                 " + min.toString().padStart(2, '0') + ":" + secs.toString().padStart(2, '0'));
}

// Format the conteder information using the values and the style provided
function formatContenderInfo(contender, newName, newForms, newSchool, style=currentStyle, align="left") {

    // Get contender info containers and their bounding boxes
    var contenderName = contender.find('.contender-name-container');
    var contenderForms = contender.find('.contender-forms');
    var contenderSchool = contender.find('.contender-school-container');
    var nameBox = contenderName.get(0).getBoundingClientRect();
    var formsBox = contenderForms.get(0).getBoundingClientRect();
    var schoolBox = contenderSchool.get(0).getBoundingClientRect();

    // Get current form and gap width
    var formIconsWidth = currentStyle['formIconsWidth'];
    var formIconsGapWidth = currentStyle['formIconsGapWidth'];

    // Format contender info with left alignment (name before forms)
    if(align === "left") {

        // Set and format contender's name and style
        contenderName.css("font-size",  style["nameFontSize"] + "px");
        contenderName.find('.contender-name').text(newName);

        // Move contender's form icons left by the difference between the previous and
        // the current name length and down by the difference between the previous and
        // the current name height
        var newNameBox = contenderName.get(0).getBoundingClientRect();
        var dX = newNameBox.width - defaultLeftNameWidth;
        var dY = newNameBox.height - defaultLeftNameHeight;
        contenderForms.attr("transform", "translate(" + dX + ", " + (-dY/2) + ")");

        // Hide contender's inactive form icons, set the active ones as visible, and compact them
        var currentX=0;
        var startX = 0;
        $.each(contenderForms.find('.form-icon'), function(index, value) {
            var formId = $(this).data('form-id');
            if($.inArray(formId, formIds) && $.inArray(formId, newForms) !== -1) {
                TweenMax.set($(this), {x: -currentX, y: 0});
                if(!$(this).hasClass('active')) {
                    $(this).addClass("active");
                }
            } else {
                TweenMax.set($(this), {x: -startX, y: -3000});
                if($(this).hasClass('active')) {
                    $(this).removeClass("active");
                }
                currentX = currentX + formIconsWidth + formIconsGapWidth;
            }
            startX = startX + formIconsWidth + formIconsGapWidth;
        });

        // Scale contender's form icons according to the current style
        scaleContenderForms(contenderForms, style["formIconsWidth"], style["formIconsGapWidth"], "left");

        // Set and format contender's school
        contenderSchool.css("font-size",  style["schoolFontSize"] + "px");
        contenderSchool.find('.contender-school').text(newSchool);
    }

    // Format contender info with left alignment (name after forms)
    else if(align === "right") {

        // Set and format contender's name and style
        contenderName.css("font-size",  style["nameFontSize"] + "px");
        contenderName.find('.contender-name').text(newName);

        // Move contender's form icons right by the difference between the previous and
        // the current name length and down by the difference between the previous and
        // the current name height
        var newNameBox = contenderName.get(0).getBoundingClientRect();
        var dX = newNameBox.width - defaultRightNameWidth;
        var dY = newNameBox.height - defaultRightNameHeight;
        contenderForms.attr("transform", "translate(" + (-dX) + ", " + (-dY/2) + ")");

        // Hide contender's inactive form icons, set the active ones as visible, and compact them
        var currentX=0;
        var startX = 0;
        $.each(contenderForms.find('.form-icon'), function(index, value) {
            var formId = $(this).data('form-id');
            if($.inArray(formId, formIds) && $.inArray(formId, newForms) !== -1) {
                TweenMax.set($(this), {x: currentX, y: 0});
                if(!$(this).hasClass('active')) {
                    $(this).addClass("active");
                }
            } else {
                TweenMax.set($(this), {x: startX, y: -3000});
                if($(this).hasClass('active')) {
                    $(this).removeClass("active");
                }
                currentX = currentX + formIconsWidth + formIconsGapWidth;
            }
            startX = startX + formIconsWidth + formIconsGapWidth;
        });

        // Scale contender's form icons according to the current style
        scaleContenderForms(contenderForms, style["formIconsWidth"], style["formIconsGapWidth"], "right");

        // Set and format contender's school
        contenderSchool.css("font-size",  style["schoolFontSize"] + "px");
        contenderSchool.find('.contender-school').text(newSchool);
    }
}

function fixFormIconsPosition() {
    $.each($('#left-contender-forms').find('.form-icon'), function(index, value) {
        var formId = $(this).data('form-id');
        if($(this).hasClass('active')) {
            $(this).css("visibility", 'visible');
        } else {
            $(this).css("visibility", 'hidden');
        }
    });
    $.each($('#right-contender-forms').find('.form-icon'), function(index, value) {
        var formId = $(this).data('form-id');
        if($(this).hasClass('active')) {
            $(this).css("visibility", 'visible');
        } else {
            $(this).css("visibility", 'hidden');
        }
    });
}

function shortenContedersNamesAndSchools(contendersInfo) {

    // Get left and right contender info components
    var leftContenderInfo = $('#left-contender-text');
    var leftContenderSchool = $('#left-contender-school-container');
    var leftContenderSchoolBox = leftContenderSchool.get(0).getBBox();
    var rightContenderInfo = $('#right-contender-text');
    var rightContenderSchool = $('#right-contender-school-container');
    var rightContenderSchoolBox = rightContenderSchool.get(0).getBBox();
    var leftInfoBox = leftContenderInfo.get(0).getBBox();
    var rightInfoBox = rightContenderInfo.get(0).getBBox();

    // Shorten left contender school until it fits
    var leftContenderSchoolExcess = leftContenderSchoolBox.width - (defaultLeftInfoBox.width - defaultLeftInfoBox.width*5/100);
    if(leftContenderSchoolExcess > 0) {
        var i=0;
        while(leftContenderSchoolExcess > 0) {
            var shortenedSchool = currentLeftSchool.slice(0, -3-i) + "...";
            formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, shortenedSchool, currentStyle, "left");
            leftContenderSchoolBox = leftContenderSchool.get(0).getBBox();
            leftContenderSchoolExcess = leftContenderSchoolBox.width - (defaultLeftInfoBox.width - defaultLeftInfoBox.width*5/100);
            var last = i;
            i = Math.min(i+1, currentLeftSchool.length - 3 -1);
            if(last == i) break;
        }
        currentLeftSchool = shortenedSchool;
    }

    // Shorten right contender school until it fits
    var rightContenderSchoolExcess = rightContenderSchoolBox.width - (defaultRightInfoBox.width - defaultRightInfoBox.width*5/100);
    if(rightContenderSchoolExcess > 0) {
        var i=0;
        while(rightContenderSchoolExcess > 0) {
            var shortenedSchool = currentRightSchool.slice(0, -3-i) + "...";
            formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, shortenedSchool, currentStyle, "right");
            rightContenderSchoolBox = rightContenderSchool.get(0).getBBox();
            rightContenderSchoolExcess = rightContenderSchoolBox.width - (defaultRightInfoBox.width - defaultRightInfoBox.width*5/100);
            var last = i;
            i = Math.min(i+1, currentRightSchool.length - 3 -1);
            if(last == i) break;
        }
        currentRightSchool = shortenedSchool;
    }

    // Shorten left contender name until it fits
    var leftExcess = leftInfoBox.width - defaultLeftInfoBox.width;
    if(leftExcess > 0) {
        var i=0;
        while(leftExcess > 0) {
            var shortenedName = currentLeftName.slice(0, -3-i) + "...";
            formatContenderInfo(leftContenderInfo, shortenedName, currentLeftForms, currentLeftSchool, currentStyle, "left");
            leftInfoBox = leftContenderInfo.get(0).getBBox();
            leftExcess = leftInfoBox.width - defaultLeftInfoBox.width;
            var last = i;
            i = Math.min(i+1, currentLeftName.length - 3 -1);
            if(last == i) break;
        }
        currentLeftName = shortenedName;
    }

    // Shorten right contender name until it fits
    var rightExcess = rightInfoBox.width - defaultRightInfoBox.width;
    if(rightExcess > 0) {
        var i=0;
        while(rightExcess > 0) {
            var shortenedName = currentRightName.slice(0, -3-i) + "...";
            formatContenderInfo(rightContenderInfo, shortenedName, currentRightForms, currentRightSchool, currentStyle, "right");
            rightInfoBox = rightContenderInfo.get(0).getBBox();
            rightExcess = rightInfoBox.width - defaultRightInfoBox.width;
            var last = i;
            i = Math.min(i+1, currentRightName.length - 3 -1);
            if(last == i) break;
        }
        currentRightName = shortenedName;
    }
}

function showAcademyLogos(leftContenderAcademy, rightContenderAcademy) {

    // Hide all academ logos
    $('.academy-logo').css('display', 'none');

    // Show proper left contender academy logo
    switch(leftContenderAcademy) {
        case "Alpha":
            $("#left-logo-alpha").css("display", "inline");
            break;
        case "Aemilia":
            $("#left-logo-aemilia").css("display", "inline");
            break;
        case "Porta dei Laghi":
            $("#left-logo-porta").css("display", "inline");
            break;
        case "Roma":
            $("#left-logo-roma").css("display", "inline");
            break;
        case "Adriatica":
            $("#left-logo-adriatica").css("display", "inline");
            break;
    }

    // Show proper right contender academy logo
    switch(rightContenderAcademy) {
        case "Alpha":
            $("#right-logo-alpha").css("display", "inline");
            break;
        case "Aemilia":
            $("#right-logo-aemilia").css("display", "inline");
            break;
        case "Porta dei Laghi":
            $("#right-logo-porta").css("display", "inline");
            break;
        case "Roma":
            $("#right-logo-roma").css("display", "inline");
            break;
        case "Adriatica":
            $("#right-logo-adriatica").css("display", "inline");
            break;
    }
}

function updatePhase(phase) {
    currentPhase = phase;
    var footer = $('#footer');
    TweenMax.set(footer, { y: -390, autoAlpha: 0 });
    var footerBox = footer.get(0).getBoundingClientRect();
    var phaseText = $('#phase-text');
    var phaseTextContainer = $('#phase-text-container');
    phaseText.text(phase);
    TweenMax.set(phaseTextContainer, { y: -390, autoAlpha: 0 });
    // var leftCard = $('#left-card');
    // var rightCard = $('#right-card');
    // TweenMax.set(leftCard, { css : {opacity : 0} });
    // TweenMax.set(rightCard, { css : {opacity : 0} });
}

// Update the contenders' info in the fight overlay frame making them fit the allotted space
function updateContendersInfo(contendersInfo) {

    // Initiaize overflow flag (used to signal that either the left or right contender info box
    // is overflowing the allotted space)
    var overflow = false;

    // Update current frame status
    currentLeftName = currentDisplayedLeftName = contendersInfo["left"]["name"];
    currentLeftSchool = currentDisplayedLeftSchool = "LudoSport " + contendersInfo["left"]["academy"] + " - " + contendersInfo["left"]["school"];
    currentLeftForms = contendersInfo["left"]["forms"];
    currentRightName = currentDisplayedRightName = contendersInfo["right"]["name"];
    currentRightSchool = currentDisplayedRightSchool = "LudoSport " + contendersInfo["right"]["academy"] + " - " + contendersInfo["right"]["school"];
    currentRightForms = contendersInfo["right"]["forms"];

    // Show academy logos
    showAcademyLogos(contendersInfo["left"]["academy"], contendersInfo["right"]["academy"]);

    // Get left contender info components and sub-components
    var leftContenderInfo = $('#left-contender-text');
    var leftContenderName = $('#left-contender-name-container');
    var leftContenderSchool = $('#left-contender-school-container');
    var leftContenderAcademy = $('#left-contender-academy-logo');
    var leftContenderForms = $('#left-contender-forms');

    // Get right contender info components and sub-components
    var rightContenderInfo = $('#right-contender-text');
    var rightContenderName = $('#right-contender-name-container');
    var rightContenderSchool = $('#right-contender-school-container');
    var rightContenderAcademy = $('#right-contender-academy-logo');
    var rightContenderForms = $('#right-contender-forms');

    // Try to format contenders' info using the default style
    currentStyle = $.extend({}, defaultStyle);
    formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, currentLeftSchool, currentStyle, "left");
    formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, currentRightSchool, currentStyle, "right");

    // Make contenders' school text fit the allotted space
    var leftContenderSchoolBox = leftContenderSchool.get(0).getBoundingClientRect();
    var leftContenderSchoolExcess = leftContenderSchoolBox.width - (defaultLeftInfoBox.width - defaultLeftInfoBox.width*5/100);
    var rightContenderSchoolBox = rightContenderSchool.get(0).getBoundingClientRect();
    var rightContenderSchoolExcess = rightContenderSchoolBox.width - (defaultRightInfoBox.width - defaultRightInfoBox.width*5/100);
    if(leftContenderSchoolExcess > 0 || rightContenderSchoolExcess >0) {

        // Scale the left contender's school text until it fits the allotted space, then scale
        // the other one of the same amount
        var newStyle = $.extend({}, currentStyle);
        if(leftContenderSchoolExcess > rightContenderSchoolExcess) {
            while(leftContenderSchoolExcess > 0) {

                // Scale school font size in current style
                newStyle["schoolFontSize"] = Math.max(schoolFontSizeScaleFactor*newStyle["schoolFontSize"], minSchoolsFontSize);

                // Reformat left contender's info
                formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, currentLeftSchool, newStyle, "left");

                // Recompute left school excess space
                var lastLeftContenderSchoolExcess = leftContenderSchoolExcess;
                leftContenderSchoolBox = leftContenderSchool.get(0).getBoundingClientRect();
                leftContenderSchoolExcess = leftContenderSchoolBox.width - (defaultLeftInfoBox.width - defaultLeftInfoBox.width*5/100);
                if(leftContenderSchoolExcess >= lastLeftContenderSchoolExcess) {
                    overflow = true;
                    break;
                }
            }

            // Format the right conteder's info according to the current style
            formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, currentRightSchool, newStyle, "right");
        }

        // Scale the right contender's school text until it fits the allotted space, then scale
        // the other one of the same amount
        else {
            while(rightContenderSchoolExcess > 0) {

                // Scale school font size in current style
                newStyle["schoolFontSize"] = Math.max(schoolFontSizeScaleFactor*newStyle["schoolFontSize"], minSchoolsFontSize);

                // Reformat right contender's info
                formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, currentRightSchool, newStyle, "right");

                // Recompute right school excess space
                var lastRightContenderSchoolExcess = rightContenderSchoolExcess;
                rightContenderSchoolBox = rightContenderSchool.get(0).getBoundingClientRect();
                rightContenderSchoolExcess = rightContenderSchoolBox.width - (defaultRightInfoBox.width - defaultRightInfoBox.width*5/100);
                if(rightContenderSchoolExcess >= lastRightContenderSchoolExcess) {
                    overflow = true;
                    break;
                }
            }

            // Format the left conteder's info according to the current style
            formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, currentLeftSchool, newStyle, "left");

        }

        // Update current style
        currentStyle = $.extend({}, newStyle);
    }

    // Check if contenders' info fit or should be scaled
    var leftInfoBox = leftContenderInfo.get(0).getBoundingClientRect();
    var rightInfoBox = rightContenderInfo.get(0).getBoundingClientRect();
    var leftExcess = leftInfoBox.width - defaultLeftInfoBox.width;
    var rightExcess = rightInfoBox.width - defaultRightInfoBox.width;

    // If none of the contenders' info exceeds the allotted space return
    if(leftExcess < 0 && rightExcess < 0) {
        return overflow;
    }

    // Otherwise, we need to scale the wider contender's info box until it fits the allotted space and then scale
    // the other one of the same amount in order to keep them harmonious
    var newStyle = $.extend({}, currentStyle);
    if(leftExcess > rightExcess) {

        // Make left contender's info box fit into allotted space
        while(leftExcess > 0) {

            // Scale form icons and name font size in current style
            newStyle["formIconsWidth"] = Math.max(formIconsScaleFactor*newStyle["formIconsWidth"], minFormIconsWidth);
            newStyle["nameFontSize"] = Math.max(nameFontSizeScaleFactor*newStyle["nameFontSize"], minNamesFontSize);

            // Reformat left contender's info
            formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, currentLeftSchool, newStyle, "left");

            // Recompute left excess space
            var lastLeftExcess = leftExcess;
            leftInfoBox = leftContenderInfo.get(0).getBoundingClientRect();
            leftExcess = leftInfoBox.width - defaultLeftInfoBox.width;
            if(leftExcess >= lastLeftExcess) {
                overflow = true;
                break;
            }
        }

        // Format the right conteder's info according to the current style
        formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, currentRightSchool, newStyle, "right");

        // Update current style
        currentStyle = $.extend({}, newStyle);
    } else {

        // Make right contender's info box fit into allotted space
        while(rightExcess > 0) {

            // Scale form icons and name font size in current style
            newStyle["formIconsWidth"] = Math.max(formIconsScaleFactor*newStyle["formIconsWidth"], minFormIconsWidth);
            newStyle["nameFontSize"] = Math.max(nameFontSizeScaleFactor*newStyle["nameFontSize"], minNamesFontSize);

            // Reformat right contender's info
            formatContenderInfo(rightContenderInfo, currentRightName, currentRightForms, currentRightSchool, newStyle, "right");

            // Recompute right excess space
            var lastRightExcess = rightExcess;
            rightInfoBox = rightContenderInfo.get(0).getBoundingClientRect();
            rightExcess = rightInfoBox.width - defaultRightInfoBox.width;
            if(rightExcess >= lastRightExcess) {
                overflow = true;
                break;
            }
        }

        // Format the left conteder's info according to the current style
        formatContenderInfo(leftContenderInfo, currentLeftName, currentLeftForms, currentLeftSchool, newStyle, "left");

        // Update current style
        currentStyle = $.extend({}, newStyle);
    }

    return overflow;


    /*
    if(leftExcess > 0 || rightExcess > 0) {

        console.log("RESCALED");

        var fixed = defaultPadding + (contendersInfo["left"]["forms"].length -1)*currentStyle["formIconsGapWidth"];

        // Compute scale factor
        var formIconsScaleFactor = null;
        var nameFontSizeScaleFactor = null;
        if(leftExcess > rightExcess) {
            formIconsScaleFactor = (defaultLeftInfoBox.width - fixed)/(leftInfoBox.width - fixed);
            nameFontSizeScaleFactor = formIconsScaleFactor;
        } else {
            formIconsScaleFactor = (defaultRightInfoBox.width - fixed)/(rightInfoBox.width - fixed);
            nameFontSizeScaleFactor = formIconsScaleFactor;
        }

        // Scale current style
        newStyle["formIconsWidth"] = formIconsScaleFactor*currentStyle["formIconsWidth"];
        newStyle["nameFontSize"] = nameFontSizeScaleFactor*currentStyle["nameFontSize"];

        // Reformat contenders' info
        formatContenderInfo(leftContenderInfo, contendersInfo["left"]["name"], contendersInfo["left"]["forms"], contendersInfo["left"]["school"], newStyle, "left");
        formatContenderInfo(rightContenderInfo, contendersInfo["right"]["name"], contendersInfo["right"]["forms"], contendersInfo["right"]["school"], newStyle, "right");

        // Update current style
        currentStyle = $.extend({}, newStyle);
    }*/
}

$(document).ready(function() {

    // Compute default sizes
    computeDefaultSizes();
    //scaleContenderForms($('#left-contender-forms'), 12, 8, "left");
    //initializeFrame();
    //showFightFrameOverlay(useAnimation=false, onComplete=setFrameShown);

    // Setup timer inside svg element
    $('.timer').countimer({
        displayMode : 3,
        useHours : false,
        autoStart : false
    });


    function updateAssaults(assaults) {
        for(var i=1; i<=assaults; ++i) {
            $('#assault-' + i + "-done").css("display", "inline").css("z-index", 3000);
            $('#assault-' + i + "-todo").css("display", "none").css("z-index", 0);
        }
        for(var i=assaults+1; i<=3; ++i) {
            $('#assault-' + i + "-done").css("display", "none").css("z-index", 0);;
            $('#assault-' + i + "-todo").css("display", "inline").css("z-index", 3000);;
        }
    }

    function hideAssaults() {
        $('#assaults').css("display", "none");
    }

    function showAssaults() {
        $('#assaults').css("display", "inline");
    }

    function updateScores(scores) {
        $('#left-contender-score').text(scores["left"]);
        $('#right-contender-score').text(scores["right"]);
    }

    function clearScores() {
        updateScores({
            "left" : 0,
            "right" : 0
        });
    }

    function setFrameShown(){
        isFrameShown = true;
    }

    function setFrameHidden(){
        isFrameShown = false;
    }

    // Function to get URL parameter
    var getUrlParameter = function getUrlParameter(sParam) {
        var sPageURL = window.location.search.substring(1),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
            }
        }
        return undefined;
    };

    // Connect to server through a web socket
    var arena = getUrlParameter("arena");
    let isPreview = getUrlParameter("preview");
    var doShowAssaults = true;
    var socket = null;
    if(!isPreview) socket = new WebSocket('ws://localhost:3000/registerFightOverlay?arena='+arena);

    // Set web socket message callback
    if(arena && socket) {
        socket.onmessage = function(e) {

        // Get message data
        var json = JSON.parse(e.data);
        var message = json['message'];
        var data = json['data'];

        // Handle update messages
        switch(message) {


            // Shows the fight frame overlay
            case "showOverlay":
                if(!isFrameShown) {
                    var useAnimation = data['useAnimation'] || false;
                    showFightFrameOverlay(useAnimation, onComplete=setFrameShown);
                }
                break;

            // Hides the fight frame overlay
            case "hideOverlay":
                if(isFrameShown) {
                    var useAnimation = data['useAnimation'] || false;
                    hideFightFrameOverlay(useAnimation, onComplete=setFrameHidden);
                }
                break;

            // Prepare the fight frame overlay for a new fight
            case "prepareFight":

                // Check if animation should be played to show the new fight frame overlay
                // (by default play the animation if no previous fight frame overlay is
                // currently shown, don't play it otherwise)
                var doUseAnimation = !isFrameShown ? true : false;
                if(data && "useAnimation" in data) {
                    doUseAnimation = data["useAnimation"];
                }

                // Hide previously shown fight frame overlay (this is done in order to
                // reset the initial animation state)
                var alwaysHide = false;
                if(isFrameShown) {
                    if(alwaysHide) {
                        hideFightFrameOverlay(useAnimation=false, onComplete=setFrameHidden);
                    } else {
                        closeOpenFightFrameOverlay(onClose = function() {

                            // Update contenders info, if the info do not fit using the smallest
                            // formatting style, shorten the contenders' names and schools until
                            // they fit
                            var overflow = updateContendersInfo(data["contenders"]);
                            if(overflow) shortenContedersNamesAndSchools(data["contenders"]);


                            // Clear scores
                            let match = data["match"];
                            clearScores();
                            updateScores({"left" : match.leftScore, "right" : match.rightScore});

                            // Hide or clear assaults
                            doShowAssaults = data["showAssaults"];
                            if(doShowAssaults) {
                                showAssaults();
                                updateAssaults(match.assaults);
                            } else hideAssaults();

                            // Update timer
                            setTimer(match.elapsedMin, match.elapsedSec);

                            // WORKAROUND TO A PROBLEM WITH FORM ICONS FADING IN WHEN USING CLOSE+OPEN
                            // BETWEEN FIGHTS
                            fixFormIconsPosition();

                        }, onOpen = setFrameShown);
                        break;
                    }
                }

                // Update contenders info, if the info do not fit using the smallest
                // formatting style, shorten the contenders' names and schools until
                // they fit
                var overflow = updateContendersInfo(data["contenders"]);
                if(overflow) shortenContedersNamesAndSchools(data["contenders"]);

                // Update phase
                overflow = updatePhase(data["phase"]);

                // Clear scores
                clearScores();

                // Hide or clear assaults
                doShowAssaults = data["showAssaults"];
                if(doShowAssaults) {
                    showAssaults();
                    updateAssaults(0);
                } else hideAssaults();

                // Initialize new fight frame overlay with the updated information
                initializeFightFrameOverlay(doShowAssaults);

                // Show fight frame overlay either with or without animation
                showFightFrameOverlay(useAnimation=doUseAnimation, onComplete=setFrameShown);

                break;
            case "startFightTimer":
                startTimer();
                break;
            case "pauseFightTimer":
                stopTimer();
                break;
            case "updateFightTimer":
                const [mins, secs] = data["timer"].split(":");
                setTimer(mins, secs);
                break;
            case "clearFightTimer":
                stopTimer();
                setTimer(0, 0);
                break;
            case "finishFight":

                // Get hide frame flag close
                let hideFrame = data['hideFrame'] || false;

                // Stop timer
                stopTimer();
                isTimerStarted = false;

                // Reset state
                var doShowAssaults = true;

                // Hide frame (either with or without animation)
                if(isFrameShown && hideFrame) {
                    var doUseAnimation = true;
                    if(data && "useAnimation" in data) {
                        doUseAnimation = data["useAnimation"];
                    }
                    hideFightFrameOverlay(useAnimation=doUseAnimation, onComplete=setFrameHidden);
                }
                break;

            // Update the fight status in the overlay
            case "updateFightInfo":

                // Update contenders info, if the info do not fit using the smallest
                // formatting style, shorten the contenders' names and schools until
                // they fit
                var overflow = updateContendersInfo(data["contenders"]);
                if(overflow) shortenContedersNamesAndSchools(data["contenders"]);

                break;

            // Update the fight status in the overlay
            case "updateFight":

                // Update scores
                updateScores(data["scores"]);

                // Update assaults
                var assaults = parseInt(data["assaults"]);
                updateAssaults(assaults);
                break;
        }

    }
    }
});


function logStyle() {
    var leftFormIconsSize = getFormIconsSizes($('#left-contender-forms'))["formWidth"];
    var rightFormIconsSize = getFormIconsSizes($('#right-contender-forms'))["formWidth"];
    var leftFontSize = $('#left-contender-name').css('font-size');
    var rightFontSize = $('#right-contender-name').css('font-size');
    console.log("Form Icons: " + leftFormIconsSize + " Font size: " + leftFontSize);
    console.log("Form Icons: " + rightFormIconsSize + " Font size: " + rightFontSize);
}
