/* intermediateTemplates.js
---------------------------- 
this file contains the js code devoted to the proper
management of the Intermediate Templates feature. 
*/

/////////////////////////
/// SUBTEMPLATE FIELD ///
/////////////////////////

// Start setting Subtemplates' fields
$(document).ready(function() {

    $("[data-supertemplate]:not([data-supertemplate='None'])").each(function() {
        // this code applies only to first-level subtemplates
        // i.e.: subtemplates input fields within subrecords are not made ready in advance
        $(this).parent().parent().hide();
    });

    // display subtemplates input fields
    $("[data-subtemplate][data-supertemplate='None']").each(function() {
        // this code applies only to first-level subtemplates
        // i.e.: subtemplates input fields within subrecords are not made ready in advance
        prepareSubtemplateForms($(this));
    });
})

// Make Subtemplates' fields available
function prepareSubtemplateForms(element) {

    $(element).hide();
    var subtemplateFieldId = $(element).attr("id"); // id of the 'Subtemplate' field
    var oneValue = $(element).hasClass("oneValue"); // the number of accepted values for this field
    var allowDataReuse = $(element).hasClass("allowDataReuse");
    var formId = $('.corners form').attr('id') // either 'modifyForm' or 'recordForm'

    // get the Label assigned to the 'Subtemplate' field and prepare a button for adding new subrecords
    var label = $(element).parent().prev().text();
    const createSubrecordBtn = $("<span class='add-span'><i class='material-icons'>playlist_add</i><span> Define a new"+label+"</span></span>");
    createSubrecordBtn.on("click", function() {
      createSubrecord(subtemplateFieldId,label,createSubrecordBtn,dataReuse=allowDataReuse)
    });
    
    console.log(label)
    // create hidden fields to store subrecords information when loading a previously created Record (only in modify/review page)
    if (formId === "modifyForm") {

        // retrieve all existing subrecords for a given subtemplate field
        var subrecords = "";
        $('[data-input="'+subtemplateFieldId+'"').each(function() {
            subrecords+=$(this).attr('id')+";"+$(this).text()+",";
            var subformSection = $("<section class='subform_section col-md-12 col-sm-12' data-target='"+$(this).attr('id')+"'>\
                <h4 class='subrecord-title closed-title'>"+$(this).text()+"\
                    <section class='buttons-container'>\
                            <button class='btn btn-dark delete' type='button' title='delete-subrecord'>\
                                <i class='far fa-trash-alt'></i>\
                            </button>\
                    </section>\
                </h4>\
            </section>");
            subformSection.find('.delete').on('click', function(e){
                e.preventDefault();
                cancelSubrecord($(this).parent());
            })
            $(this).parent().prepend(subformSection);
            $(this).remove();
        });

        // store the existing subrecords' ids in a hidden input
        if (subrecords !== "") {
            $('#modifyForm').append('<input type="hidden" name="'+subtemplateFieldId+'-subrecords" id="'+subtemplateFieldId+'-subrecords" value="'+subrecords.slice(0,-1)+'">');
        }
    }

    if (oneValue) {
        console.log(label)
        // Max. 1 subrecord

        // set a new Id to be associated with the new subrecord
        let subrecordId;
        var now = new Date().valueOf();
        var timespanId = (now / 1000).toString().replace('.', '-');
        var existingSubrecord = $(element).prev('section.subform_section');

        // reuse existing Id in Modify/Review stage else Timespan
        if(existingSubrecord.length > 0) {
            subrecordId = existingSubrecord.attr('data-target');
        } else {
            subrecordId = timespanId;
        }

        $(element).after(createSubrecordBtn); // add the creation button to the field section
        createSubrecord(subtemplateFieldId,label,createSubrecordBtn,allowDataReuse,subrecordId,oneValue); // generate a subrecord form
        createSubrecordBtn.remove(); // remove the button to prevent users from creating new Subrecords

        if (existingSubrecord.length > 0) {
            retrieveSubrecordData(subrecordId);
            existingSubrecord.remove();
        }

        // link the subrecord id to the "Subtemplate" type field
        var hiddenSubrecordLink = $('<input type="hidden" name="'+subtemplateFieldId+'-subrecords" value="'+subrecordId+'"/>');
        $('#recordForm').append(hiddenSubrecordLink);
    } else {
        // Unlimited subrecords

        // add the createSubrecordBtn for generating unlimited subrecords
        $(element).after(createSubrecordBtn);
    }
}

//////////////////
/// SUBRECORDS ///
//////////////////

// Create subrecords
function createSubrecord(subtemplateFieldId, label, el, dataReuse=false, subrecordId=null, singleValue=false ) {
    console.log(subtemplateFieldId, label)
    var absoluteSubtemplateFieldId = subtemplateFieldId.split("_")[0];
    // prepare a new subrecord id in case no one has been provided
    if (!subrecordId) {
      var now = new Date().valueOf();
      subrecordId = (now / 1000).toString().replace('.', '-');
    }

    // prepare the new subrecord form
    const formId = $('.corners').eq(0).find('form').eq(0).attr('id'); // either 'recordForm' or 'modifyForm'
    const subrecordSection = $("<section class='subform_section col-md-12 col-sm-12'></section>");
    const subrecordForm = $("<section class='subform' id='"+subrecordId+"-form' data-target='"+subrecordId+"'></section>");


    // create a clone for each input field belonging to the available subtemplates
    // i.e.: use data-class to find templates' related fields
    var subtemplateOptions = $("#"+absoluteSubtemplateFieldId).find("option:not(:first-of-type)");
    console.log(subtemplateOptions)

    subtemplateOptions.each(function() {
        var subtemplateOptionsClass = $(this).attr("value");
        console.log(subtemplateOptionsClass)
        $("[data-class='"+subtemplateOptionsClass+"'][class~='original-template']").each(function() {
            console.log(subtemplateOptionsClass)
    
            // DATA REUSE: 
            // do not clone Elements in case data reuse is allowed and the same property is used in the upper level Form
            let moveOn = true;
            if (dataReuse==true) {
                var rdfProperty = $(this).attr('data-property');
                var upperLevelCls= $("[data-subtemplate='"+absoluteSubtemplateFieldId+"']").attr('data-class');
                if ($("[data-class='"+upperLevelCls+"'][data-property='"+rdfProperty+"']").length) {
                    moveOn = false;
                };
            }
        
            if (moveOn) {
                // CREATE A CLONE ELEMENT
                const cloneElement = $(this).parent().parent().clone();
                cloneElement.find('textarea, select:not([type="hidden"]), input:not([type="hidden"]):not(label.switch input)').attr('data-subform',subrecordId); // associate the input field with the subrecord id
                cloneElement.find('textarea, select, input').addClass('hidden');
                cloneElement.find('textarea, select, input').removeClass('original-template');
                // associate proper identifiers to input fields belonging to the subrecord form
                var inputId = cloneElement.find('textarea, select, input:not([type="hidden"]):not(label.switch input)').attr('id');
                cloneElement.find('textarea, select, input:not([type="hidden"]):not(label.switch input)').attr('id', inputId+"_"+subrecordId.toString());
                cloneElement.find('textarea, select, input:not([type="hidden"]):not(label.switch input)').attr('name', inputId+"_"+subrecordId.toString());
                console.log(cloneElement.find('.label').text(), cloneElement)
        
                // SET LITERAL INPUT FIELDS
                if (cloneElement.find('[lang]').length>0) {
                    var literalInput = cloneElement.find('[lang]');
                    var languageListSection = literalInput.parent().prev();
                    languageListSection.find('a').each(function() {
                        var onclickAttr = $(this).attr('onclick');
                        var regex = /'([^"]*)'/g;
                        var originalIdExtended = onclickAttr.match(regex)[0];
                        var originalId = originalIdExtended.substring(1, originalIdExtended.length-1)
                        $(this).attr('onclick', onclickAttr.replace(originalId, originalId+'_'+subrecordId));
                    });
                }
                // add a main-lang hidden input in case of primary key
                if (cloneElement.find('input.disambiguate').next('[type="hidden"]').length > 0) {
                    var primaryKeyLangId = cloneElement.find('input.disambiguate').next('[type="hidden"]').attr('id');
                    cloneElement.find('input[type="hidden"]').attr('id', primaryKeyLangId+"_"+subrecordId.toString());
                    cloneElement.find('input[type="hidden"]').attr('name', primaryKeyLangId+"_"+subrecordId.toString());
                    cloneElement.find('input.disambiguate').on('click', function() {
                        searchCatalogueByClass($(this).attr("id"),subtemplateFieldId,singleValue);
                    });
                }
    
                // SET SUBTEMPLATE FIELDS '+' BUTTON
                cloneElement.find('[data-subtemplate]').each(function(){
                    console.log($(this))
                    prepareSubtemplateForms($(this));
                });
        
                // retrieve previously provided values in case they are available (i.e., modify subrecords):
                let clonedElementValues = [];
                // a) single value fields
                if ($('#'+formId+' #'+inputId+"_"+subrecordId).length >0) {
                    const toBeModified = $('#'+formId+' #'+inputId+'_'+subrecordId);
                    cloneElement.find('input').val(toBeModified.val());
                } 
                // b) multiple values fields
                if ($('#'+formId+' [name^="'+inputId+'_"][name$="_'+subrecordId+'"]:not([name="'+inputId.split('_')[0]+'_'+subrecordId+'"])').length >0) {
                
                    var importedValues = $('#'+formId+' [name^="'+inputId.split('_')[0]+'_"][name$="_'+subrecordId+'"]:not([name="'+inputId.split('_')[0]+'_'+subrecordId+'"])');
                    cloneElement.find('.label div a').remove();
                    if ($('#'+inputId).hasClass('searchWikidata') || $('#'+inputId).hasClass('searchVocab') || $('#'+inputId).hasClass('searchGeonamaes')) {
                        importedValues.each(function(){
                            // imported values and URIs
                            var value = $(this).val();
                            var code = value.split(",")[0];
                            var label = decodeURIComponent(value.split(",")[1]);
                            var importedValueSpan = $("<span class='tag "+code+"' data-input='"+inputId+'__'+subrecordId+"' data-id='"+code+"'>"+label+"</span>");
                            clonedElementValues.push(importedValueSpan);
                            clonedElementValues.push($(this));
                            $(this).remove();
                        });
                    } else {
                        importedValues.each(function(){
                        // multiple-lang literal values
                        clonedElementValues.push($(this));
                        cloneElement.find('input').remove();
                        if($(this).attr('lang') != undefined) {
                            let lang = $(this).attr('lang');
                            const newLangItem = $('<a class="lang-item" title="text language: '+lang.toUpperCase()+'" onclick="show_lang(\''+$(this).attr('id')+'\')">'+lang+'</a>');
                            cloneElement.find('div').append(newLangItem);
                        } else {
                            let mainLang = $(this).val();
                            cloneElement.find('div a[title="text language: '+mainLang.toUpperCase()+'"]').addClass('main-lang');
                        }       
                        });
                        cloneElement.find('div a').eq(0).addClass('selected-lang');
                        clonedElementValues[0].show();
                    }
                } 
                // c) subrecords fields (inner subrecords)
                /* if ($('[name="'+inputId+'_'+subrecordId+'-subrecords"]').length>0) {
                    // retrieve subrecords
                    var subrecords = $('[name="'+inputId+'_'+subrecordId+'-subrecords"]').val().split(',');
                    console.log("Sub", subrecords)
                    var subtemplateFieldId = $(this).attr('name').replace('-subrecords', '');
                    var subrecordCls = $('#'+subtemplateFieldId).attr('subtemplate')
                    for (let i=0; i<subrecords.length;i++){
                        var code = subrecords[i];
                        let label = "";
                        if (subrecords[i].includes(";")) {
                            code = subrecords[i].split(";")[0];
                            label = subrecords[i].split(";")[1];
                        } else {          
                            var subrecordLabelField = $('.original-template.disambiguate[class*="('+subrecordCls+')"]');
                            if (subrecordLabelField.length > 0) {
                                var mainLang = $('#'+subrecordLabelField.attr('id').split('_')[0] + '_mainLang_' + code).val();
                                label = $('#'+subrecordLabelField.attr('id').split('_')[0]+'_'+mainLang+'_'+code).val();
                            }
                        }
                    }
                } */
    
                cloneElement.find('.input_or_select').eq(0).append(clonedElementValues);
                subrecordForm.append(cloneElement);
                console.log(subrecordForm)
            }
        
        })
    })
    
    // Add Knowledge Extraction input field if required

    // TODO: MODIFY
    /* var resourceTemplate = $('[data-subtemplate="'+resourceClass+'"').attr('data-subtemplateid');
    if (extractorsArray.includes(resourceTemplate)) {
    generateExtractionField(subrecordId,subrecordForm);
    } */


    
    // Accordion title
    const subrecordTitle = $("<h4 class='subrecord-title italic' onclick='toggleSubform(this)'>New instance of "+label+"<i class='fas fa-chevron-down chevron'></i></h4>");
    subrecordSection.append(subrecordTitle);
    
    // Save button, Cancel button
    if (singleValue===false) {
        // save or cancel subrecord (buttons)
        const subrecordButtons = $("<section class='row subform-buttons buttonsSection'></section>");
        const saveSubrecordButton = $("<button id='subrecord-save' type='button' class='btn btn-dark'><i class='material-icons'>task_alt</i></button");
        const cancelSubrecordButton = $("<button id='subrecord-cancel' type='button' class='btn btn-dark delete'><i class='far fa-trash-alt'></i></button");
        
        // SAVE SUBRECORD
        saveSubrecordButton.on('click', function(e) {
            console.log("HHH")
            e.preventDefault();
            // generate a tag
            var isValid = checkMandatoryFields(this);
            if (isValid) {
                var labelField = subrecordForm.find('.disambiguate').eq(0);
                var labelMainLang = $('#'+labelField.attr('id').replace(labelField.attr('lang'), 'mainLang')).val();
                var tagLabel = subrecordForm.find('.disambiguate[lang="'+labelMainLang+'"]').val() || (label + "-" + subrecordId);
                
                toggleSubform(subrecordTitle,label=tagLabel);
        
                // for each subtemplate field, create a hidden input value including a list of related subrecords
                // this is needed to streamline the creation of records (back-end application)
                var subrecordBase = subtemplateFieldId;
                var createdSubrecords = $('[name="'+subrecordBase+'-subrecords"]');
                if (createdSubrecords.length) {
                    var toExtendValue = createdSubrecords.val();
                    if (!createdSubrecords.val().split(',').includes(subrecordId)) {
                        createdSubrecords.val(toExtendValue + "," + subrecordId);
                    }
                } else {
                    const newSubrecord = $("<input type='hidden' name='"+subrecordBase+"-subrecords' value='"+subrecordId+"'>");
                    $('#'+formId).append(newSubrecord);
                }
            }
            return false;
        });
        
        // CANCEL SUBRECORD
        cancelSubrecordButton.on('click', function(e) {
            // hide_subform
            e.preventDefault();
            cancelSubrecord(this);
        });
        
        subrecordButtons.append(cancelSubrecordButton, saveSubrecordButton);
        subrecordForm.append(subrecordButtons);
    }

    // show the dropdown in case multiple templates are available
    var subtemplateSelect = $(el).parent().find('select[data-subtemplate]:first-of-type')
    var templatesNumber = $(subtemplateSelect).find('option').length - 1;
    console.log(templatesNumber);
    if (templatesNumber > 1) { 
        subtemplateSelect.show();
        subtemplateSelect.on('change', function() { activateTemplateSelection($(this),subrecordId) })
        const subtemplateSelectSection = $("<section>").addClass("form_row block_field subtemplate-select")
            .append($("<section>").addClass("col-md-12 col-sm-12 col-lg-12 input_or_select detect_web_page")
            .append(subtemplateSelect));
        subrecordForm.prepend(subtemplateSelectSection);
    } else {
        subrecordForm.find('[data-subform="'+subrecordId+'"]').parent().parent().show();
        saveSubrecordClass(subtemplateSelect,subrecordId,true);
        subrecordForm.find('[data-subform="'+subrecordId+'"]').parent().parent().parent().parent().parent().parent().show();
    }

    subrecordForm.find("input[type='text'], input[type='textarea']").on('keyup keypress', function(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13) {
          e.preventDefault();
          return false;
        }
    });
    subrecordSection.append(subrecordForm);
    $(el).before(subrecordSection);
    
}

function activateTemplateSelection(select,subrecordId) {
    var selected = $(select).val();
    console.log(selected)
    $(select).parent().parent().parent().find('.form_row.block_field:not(.subtemplate-select)').hide();
    $(select).parent().parent().parent().find('[data-class="'+selected+'"]').parent().parent().show();
    saveSubrecordClass($(select),subrecordId,false)
    $(select).parent().parent().parent().find('select[data-class="'+selected+'"]').parent().parent().parent().parent().parent().parent().show();
}

function saveSubrecordClass(selectElement,subrecordId,singleOption=false) {
    // store the selected subtemplate class as a hidden input value
    console.log("HERE", subrecordId)
    var selectedClass;
    selectedClass = singleOption 
                ? selectElement.find('option:last').val() 
                : selectElement.val();
    var classHiddenInput = $("<input type='hidden' name='"+subrecordId+"-class' value='"+selectedClass+"'>");
    $('#modifyForm, #recordForm').append(classHiddenInput);
}


// CANCEL SUBRECORD (before adding it to #recordForm)
function cancelSubrecord(subrecord_section) {
    console.log("here!!d")
    $(subrecord_section).closest('.subform_section').remove();
};

// DELETE or MODIFY SUBRECORD (after it has been added to #recordForm)
function modifySubrecord(subId, keep) {
    console.log("here!!d")
    // get the 'Subtemplate' input field and the 'Subtemplate' class
    var originalSubtemplateId = $('[name*="-subrecords"][value*="'+subId+'"').attr('name').replace("-subrecords", "");
    var originalSubtemplateClass = $('#'+originalSubtemplateId).attr('data-subtemplate');

    if (!keep) {
        // remove all inputs
        var subrecordsListString = $('[name$="-subrecords"][value*='+subId+'"]');
        var subrecordsListArray = subrecordsListString.split(',');
        var idx = subrecordsListArray.indexOf(sub_id);
        var newList = subrecordsListArray.splice(idx, 1);
        subrecordsList.val(newList.join(','));
    }

    // remove delete/modify icons
    $('#'+subId+'-tag').next('i').remove();
    $('#'+subId+'-tag').next('i').remove();
    $('#'+subId+'-tag').remove();
    $('#'+subId).remove();
}


// hide and show subrecord input fields
function toggleSubform(element,label=null) {
    $(element).find('.chevron').toggleClass('rotate');
    $(element).toggleClass('closed-title');
    $(element).next('.subform').toggleClass('closed');
  
    // change Subrecord title
    if (label) {
        const subrecordId = $(element).next('.subform').attr('id').replace('-form', '')
        $(element).html(label+"<section class='buttons-container'>\
        <button class='btn btn-dark delete' type='button' title='delete-subrecord'>\
            <i class='far fa-trash-alt'></i>\
        </button>\
        <button class='btn btn-dark modify' type='button' title='modify-subrecord'>\
            <i class='far fa-edit'></i>\
        </button>\
        </section>");

        // delete button
        $(element).find('.delete').on('click', function(e) {
            e.preventDefault();
            cancelSubrecord($(this).parent());
        });

        // modify button 
        $(element).find('.modify').on('click', function(e) {
            e.preventDefault();
            modifySubrecord(subrecordId, keep=true);
        });

        // style
        $(element).removeClass('italic');
        $('html, body').animate({
            scrollTop: $(element).parent().offset().top - 200
        }, 800);
    }
}

// retrieve data from previously created Subrecord 
function retrieveSubrecordData(subrecordId) {
    
    var subrecordUrl = "/modify-" + subrecordId;
    $.ajax({
        type:'GET',
        url:subrecordUrl,
        dataType:"html",
        success:function(data) {
            console.log(data)
            var relevantField = $(data).find('[class*="'+originalSubtemplateClass+'"]');
            $('#modifyForm').append(relevantField);
            createSubrecord(originalSubtemplateClass,label,el,subrecordId=subId);
        }
    });
}