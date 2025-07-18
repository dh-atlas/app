/* template.js
----------------------------- 
this file collects all the js functions needed 
to create or modify templates and their input fields 
*/

///////////////
/// GENERAL ///
///////////////

// search a rdf property in LOV
function searchLOV(searchterm) {
    $('#'+searchterm).off('keyup').on('keyup',function(e) {
        var q = $('#'+searchterm).val();
        var searchres_div = $('#'+searchterm).next().attr('id');
        if (q === '') {
            $("#"+searchres_div).empty();
        } else {
            $("#"+searchres_div).show();
            $.ajax({
                type: 'GET',
                url: "https://lov.linkeddata.es/dataset/lov/api/v2/term/autocomplete?q="+q+"&type=property",
                success: function(data) {
                    // autocomplete positioning
                    var position = $('#'+searchterm).position();
                    var leftpos =  position.left + 15 - $('#'+searchterm).parent().parent().position().left;
                    var offset = $('#'+searchterm).offset();
                    var height = $('#'+searchterm).height();
                    var width = $('#'+searchterm).width();
                    var top = offset.top + height - 275 + "px";
                    var right = offset.left + width + "px";

                    $('#'+searchres_div).css( {
                        'position': 'absolute',
                        'margin-left': leftpos+'px',
                        'top': top,
                        'z-index':1000,
                        'background-color': 'white',
                        'border':'solid 1px grey',
                        'max-width':'600px',
                    });
                    $("#"+searchres_div).empty();

                    // fill the dropdown
                    $.each(data.results, function(i, item) {
                        $("#"+searchres_div).append("<div class='wditem'><a href='"+item.uri+"' target='_blank' class='blue' data-id='" + item.prefixedName + "'>" + item.prefixedName + "</a> - " + item.uri + "</div>");

                        // add tag if the user chooses an item from wd
                        $('a[data-id="'+ item.prefixedName+'"]').each( function() {
                            $(this).bind('click', function(e) {
                                e.preventDefault();
                                $("#"+searchres_div).hide();
                                $('#'+searchterm).val(item.uri);
                            });

                        });
                    });
                }
            });
        }
    });
};

// update index of fields in template page (to store the final order)
function updateindex() {
    $('.sortable .block_field').each(function(){
      var idx = $(".block_field").index(this);
      $(this).attr( "data-index", idx );
      var everyChild = this.getElementsByTagName("*");
      for (var i = 0; i< everyChild.length; i++) {
        var childid = everyChild[i].id;
        var childname = everyChild[i].name;
        if (childid != undefined) {
          if (!isNaN(+childid.charAt(0))) { everyChild[i].id = idx+'__'+childid.split(/__(.+)/)[1]}
          else {everyChild[i].id = idx+'__'+childid;}
        };
        if (childname != undefined) {
          if (!isNaN(+childname.charAt(0))) { everyChild[i].name = idx+'__'+childname.split(/__(.+)/)[1]}
          else {everyChild[i].name = idx+'__'+childname;}
        };
  
        if (everyChild[i].id.includes("property")) {
          searchLOV(everyChild[i].id);
        };
      };
    });
  };
  
// move blocks up/down when clicking on arrow
function moveUpAndDown() {
    var selected=0;
    var itemlist = $('.sortable');
    var nodes = $(itemlist).children();
    var len=$(itemlist).children().length;
    // initialize index
    updateindex();
  
    $(".sortable .block_field").click(function(){
        selected= $(this).index();
    });
  
    $(".up").click(function(e){
        e.preventDefault();
        if(selected>0) {
            jQuery($(itemlist).children().eq(selected-1)).before(jQuery($(itemlist).children().eq(selected)));
            selected=selected-1;
            updateindex();
        };
  
    });
  
    $(".down").click(function(e){
        e.preventDefault();
        if(selected < len) {
            jQuery($(itemlist).children().eq(selected+1)).after(jQuery($(itemlist).children().eq(selected)));
            selected=selected+1;
            updateindex();
        };
    });
  
  
  };
  
// if field type is selected
function is_selected(st, field) {
    if (st == field) {return "selected='selected'"} else {return ""};
};

// add new field in template
function add_field(field, res_type, backend_file=null) {
    // backend_file argument is currently used to load the information about the available SKOS vocabularies


    const isSubclassSelected = $('select').filter(function() {
        return $(this).val() === "Subclass";
    }).length > 0;
    if (isSubclassSelected && field==="Subclass") {
        showErrorPopup("Subclass field already exists", "Only one Subclass field is allowed.");
        return false;
    }
    
    var is_subclass_active = Object.keys(subclasses).length === 0 ? false : true;
    var contents = "";
    var temp_id = Date.now().toString(); // to be replaced with label id before submitting

    var field_type = "<section class='row'>\
        <label class='col-md-3'>FIELD TYPE</label>\
        <select onchange='change_fields(this)' class='col-md-8 ("+res_type+") custom-select' id='type__"+temp_id+"' name='type__"+temp_id+"'>\
        <option value='None'>Select</option>\
        <option value='Textbox' "+is_selected('Textbox',field)+">Textbox (text values or name of entities)</option>\
        <option value='Textarea' "+is_selected('Textarea',field)+">Textarea (long textual descriptions)</option>\
        <option value='Dropdown' "+is_selected('Dropdown',field)+">Dropdown (select one value from a list)</option>\
        <option value='Checkbox' "+is_selected('Checkbox',field)+">Checkbox (multiple choice)</option>\
        <option value='Date' "+is_selected('Date',field)+">Date (select a day/month/year)</option>\
        <option value='Multimedia' "+is_selected('Multimedia',field)+">Multimedia (audio, image, video)</option>\
        <option value='Skos' "+is_selected('Skos',field)+">Vocabulary (SKOS)</option>\
        <option value='WebsitePreview' "+is_selected('WebsitePreview',field)+">Website Preview (iframe)</option>\
        <option value='KnowledgeExtractor' "+is_selected('KnowledgeExtractor',field)+">Knowledge Extraction</option>\
        <option value='Subclass' "+is_selected('Subclass',field)+">Subclass</option>\
        <option value='Subtemplate' "+is_selected('Subtemplate',field)+">Subtemplate</option>\
        </select>\
    </section>";

    var field_name = "<section class='row'>\
        <label class='col-md-3'>DISPLAY NAME</label>\
        <input type='text' id='label__"+temp_id+"' class='col-md-8' name='label__"+temp_id+"'/>\
    </section>";

    var field_prepend = "<section class='row'>\
        <label class='col-md-3'>DESCRIPTION <br><span class='comment'>a short explanation of the expected value</span></label>\
        <textarea id='prepend__"+temp_id+"' class='col-md-8 align-self-start' name='prepend__"+temp_id+"'></textarea>\
    </section>";

    var field_property = "<section class='row'>\
        <label class='col-md-3'>RDF PROPERTY <br><span class='comment'>start typing to get suggestions from LOV</span></label>\
        <input type='text' id='property__"+temp_id+"' class='col-md-8 searchLOV' name='property__"+temp_id+"'/>\
    <div id='searchresult'></div></section> ";

    var field_value = "<section class='row'>\
        <label class='col-md-3'>VALUE TYPE</label>\
        <select class='col-md-8 ("+res_type+") custom-select' id='value__"+temp_id+"' name='value__"+temp_id+"' onchange='add_disambiguate("+temp_id+",this)'>\
        <option value='None'>Select</option>\
        <option value='Literal'>Free text (Literal)</option>\
        <option value='URI'>Entity (URI from Wikidata, VIAF, or catalogue)</option>\
        <option value='Researcher'>Researcher and contributor (from ORCiD)</option>\
        <option value='Place'>Location (from GeoNames)</option>\
        <option value='URL'>URL</option>\
        </select>\
    </section>";

    var field_calendar = "<section class='row'>\
        <label class='col-md-3'>CALENDAR TYPE</label>\
        <select class='col-md-8 ("+res_type+") custom-select' id='calendar__"+temp_id+"' name='calendar__"+temp_id+"'>\
        <option value='None'>Select</option>\
        <option value='Day'>Full Date</option>\
        <option value='Month'>Month and Year</option>\
        <option value='Year'>Year</option>\
        </select>\
    </section>";

    if (backend_file != null) {
        var skos_vocabs = backend_file.split("//");
        var skos_labels = "";
        for (let i = 0; i < skos_vocabs.length; i++) {
        skos_labels = skos_labels + "<label for='skos"+i+"__"+temp_id+"'>"+skos_vocabs[i].toUpperCase()+"<input type='checkbox' id='skos"+i+"__"+temp_id+"' name='skos"+i+"__"+temp_id+"' value='"+skos_vocabs[i]+"'></label></br>";
        }
    } else {
        var skos_labels = "";
    }
    var field_available_vocabularies = "<section class='row'>\
        <label class='col-md-3'>VOCABULARIES LIST</label>\
        <section class='col-md-8'>"+skos_labels+"\
        <label class='add_vocabulary_button'>ADD A NEW VOCABULARY <i class='fas fa-plus-circle' onclick='add_skos_vocab(this)'></i></label>\
        </section>\
    </section>";

    var accepted_values_vocabularies =  "<section class='row'>\
        <label class='col-md-3'>NUMBER OF VOCABLES</label>\
        <section class='col-md-8'>\
        <label for='oneVocable__"+temp_id+"'>\
            Single vocable\
            <input type='radio' id='oneVocable__"+temp_id+"' name='vocables__"+temp_id+"' value='oneVocable' checked>\
        </label><br>\
        <label for='multipleVocables__"+temp_id+"'>\
            Multiple vocables\
            <input type='radio' id='multipleVocables__"+temp_id+"' name='vocables__"+temp_id+"' value='multipleVocables'>\
        </label><br>\
        </section>\
    </section>";

    var field_multimedia = "<section class='row'>\
        <label class='col-md-3'>MULTIMEDIA TYPE</label>\
        <select class='col-md-8 ("+res_type+") custom-select' id='multimedia__"+temp_id+"' name='multimedia__"+temp_id+"'>\
        <option value='None'>Select</option>\
        <option value='Audio'>Audio</option>\
        <option value='Image'>Image</option>\
        <option value='Video'>Video</option>\
        <option value='Audio Image Video'>All</option>\
        </select>\
    </section>";

    var field_placeholder = "<section class='row'>\
        <label class='col-md-3'>PLACEHOLDER <br><span class='comment'>an example value to be shown to the user (optional)</span></label>\
        <input type='text' id='placeholder__"+temp_id+"' class='col-md-8 align-self-start' name='placeholder__"+temp_id+"'/>\
    </section>";

    var field_values = "<section class='row'>\
        <label class='col-md-3'>VALUES<br><span class='comment'>define values as URI, label pairs</span></label>\
        <section class='col-md-8'>\
            <ul class='col-md-12 values-list' id='values__"+temp_id+"'>\
                <li>\
                    <label class='inner-label col-md-12'>Values List</label>\
                </li>\
                <li><label class='add-option'>ADD NEW VALUE <i class='fas fa-plus-circle' onclick='addLabelURI(this, "+temp_id+")'></i></label></li>\
            </ul>\
        </section>\
    </section>";

    var field_reconciliation = "<section class='row'>\
        <label class='col-md-3'>URI RECONCILIATION <br><span class='comment'>select an entity reconciliation service for missing URIs</span></label>\
        <select class='col-md-8 ("+res_type+") custom-select' id='service__"+temp_id+"' name='service__"+temp_id+"'>\
        <option value='None'>Select</option>\
        <option value='wd'>Wikidata</option>\
        <option value='viaf'>VIAF</option>\
        <option value='geonames'>Geonames</option>\
        </select>\
    </section>"

    var field_browse = "<section class='row'>\
        <label class='left col-11' for='browse__"+temp_id+"'>Use this value as a filter in <em>Explore</em> page</label>\
        <input type='checkbox' id='browse__"+temp_id+"' name='browse__"+temp_id+"'>\
    </section>";

    var field_mandatory = "<section class='row'>\
        <label class='left col-11' for='mandatory__"+temp_id+"'>Make this value mandatory</label>\
        <input type='checkbox' id='mandatory__"+temp_id+"' name='mandatory__"+temp_id+"'>\
    </section>";

    var field_hide = "<section class='row'>\
        <label class='left col-11' for='hidden__"+temp_id+"'>Hide this field from the front-end view</label>\
        <input type='checkbox' id='hidden__"+temp_id+"' name='hidden__"+temp_id+"' onclick='hide_field(this)'>\
    </section>";

    var field_subtemplate_import = "<section class='row'>\
        <label class='col-md-3'>IMPORT TEMPLATES<br><span class='comment'>end-users can use templates among selected ones</span></label>\
        <section class='col-md-8 import-section'>"+generateCheckboxes(templatesObject, temp_id)+"</section>\
    </section>";

    var field_cardinality = "<section class='row'>\
        <label class='col-md-3'>CARDINALITY <br><span class='comment'>expected values</span></label>\
        <section class='col-md-8'>\
        <label for='oneValue__"+temp_id+"'>\
            Single use of subtemplate\
            <input type='radio' id='oneValue__"+temp_id+"' name='cardinality__"+temp_id+"' value='oneValue' checked>\
        </label><br>\
        <label for='multipleValues__"+temp_id+"'>\
            Multiple uses of subtemplate\
            <input type='radio' id='multipleValues__"+temp_id+"' name='cardinality__"+temp_id+"' value='multipleValues'>\
        </label><br>\
        </section>\
    </section>";

    var field_data_inheritance = "<section class='row'>\
        <label class='col-md-3'>DATA INHERITANCE <br><span class='comment'>use upper level record data to auto-fill subtemplate fields with same property</span></label>\
        <section class='col-md-8'>\
        <label for='allowDataReuse__"+temp_id+"'>\
            Allow data inheritance\
            <input type='radio' id='allowDataReuse__"+temp_id+"' name='dataReuse__"+temp_id+"' value='allowDataReuse' checked>\
        </label><br>\
        <label for='denyDataReuse__"+temp_id+"'>\
            Deny data inheritance\
            <input type='radio' id='denyDataReuse__"+temp_id+"' name='dataReuse__"+temp_id+"' value='denyDataReuse'>\
        </label><br>\
        </section>\
    </section>";

    var field_subclass_values = "<section class='row'>\
        <label class='col-md-3'>SUBCLASSES <br><span class='comment'>define values as URI, label pairs</span></label>\
        <section class='col-md-8'>\
            <ul class='col-md-12 values-list' id='subclass__"+temp_id+"'>\
                <li>\
                    <label class='inner-label col-md-12'>Subclasses List</label>\
                </li>\
                <li><label class='add-option'>ADD NEW VALUE <i class='fas fa-plus-circle' onclick='addLabelURI(this, "+temp_id+")'></i></label></li>\
            </ul>\
        </section>\
    </section>";

    var field_subclass_other = "<section class='row'>\
        <label class='col-md-3'>OTHER <br><span class='comment'>add \"Other\" option to the Subclass dropdown</span></label>\
        <section class='col-md-8'>\
            <label for='showOther__"+temp_id+"'>\
                Show \"Other\" option\
                <input type='radio' id='showOther__"+temp_id+"' name='showOther__"+temp_id+"' value='showOther' onclick='updateSubclassRestrictionField(\"\",this,true)'>\
            </label><br>\
            <label for='hideOther__"+temp_id+"'>\
                Hide \"Other\" option\
                <input type='radio' id='hideOther__"+temp_id+"' name='showOther__"+temp_id+"' value='hideOther' onclick='updateSubclassRestrictionField(\"\",this,false)' checked>\
            </label>\
        </section>\
    </section>";

    // todo: modify the following script
    var field_subclass_restriction = "";
    if (is_subclass_active) {
        field_subclass_restriction = `<section class='subclass row'>
            <label class='col-md-3'>SUBCLASS RESTRICTED <br><span class='comment'>make this field available once a subclass has been selected</span></label>
            <section class='col-md-8'>
                <ul>
                    <label class="inner-label col-md-12">Subclasses List</label>
                    ${Object.entries(subclasses).map(([uri, label], index) => `<li>
                        <label for subclass${index}__${temp_id}>${label}</label> <input type='checkbox' value='${encodeURIComponent(uri)}' name='subclass${index}__${temp_id}'/>
                </li>`).join('')}
                </ul>
            </section>
        </section>
        `;
    }

    var open_addons = "<section id='addons__"+temp_id+"'>";
    var close_addons = "</section>";
    var up_down = '<a href="#" class="up"><i class="fas fa-arrow-up"></i></a> <a href="#" class="down"><i class="fas fa-arrow-down"></i></a><a href="#" class="trash"><i class="far fa-trash-alt"></i></a>';

    contents += field_type + field_name + field_prepend + field_property + open_addons;
    if (field =='Textbox') { contents += field_value + field_placeholder + field_subclass_restriction + field_mandatory + field_hide; }
    else if (field =='Dropdown') { contents += field_values + field_subclass_restriction + field_mandatory + field_hide + field_browse }
    else if (field =='Textarea') { contents += field_placeholder + field_subclass_restriction + field_mandatory + field_hide; }
    else if (field =='Date') { contents += field_calendar + field_subclass_restriction + field_mandatory + field_hide + field_browse ; }
    else if (field =='Skos') { contents += field_available_vocabularies + accepted_values_vocabularies + field_placeholder + field_subclass_restriction + field_mandatory + field_hide + field_browse ; }
    else if (field =='Multimedia') { contents += field_multimedia + field_placeholder + field_subclass_restriction + field_mandatory + field_hide; }
    else if (field =='WebsitePreview') { contents += field_placeholder + field_subclass_restriction + field_mandatory + field_hide; }
    else if (field =='Subtemplate') { contents += field_subtemplate_import + field_cardinality + field_data_inheritance + field_subclass_restriction + field_mandatory + field_hide + field_browse; }
    else if (field =='Subclass') { contents += field_subclass_values + field_subclass_other + field_mandatory + field_hide; }
    else if (field =='KnowledgeExtractor') { contents += open_addons + field_reconciliation + field_subclass_restriction; }
    else {contents += field_values + field_subclass_restriction + field_mandatory + field_hide + field_browse; };
    contents += close_addons + up_down;
    $(".sortable").append("<section class='block_field' data-id='"+temp_id+"'>"+contents+"</section>");
    updateindex();
    moveUpAndDown() ;

    $(".trash").click(function(e){
        e.preventDefault();

        if (field =='Subclass') {
            $(this).parent().find("label > .fa-trash-alt").each(function() {
                $(this).click();
            });
        }

        $(this).closest(".block_field").remove();
    });
};

// when changing field type, change the form
function change_fields(sel) {
    var new_field_type = sel.value;
    var block_field = $(sel).parent().parent();
  
    var idx = sel.id;
    var preserve_data_index = idx.split("__")[0]; // get the data-index value 
    var temp_id = idx.substr(idx.lastIndexOf("__")).replace('__', '');
  
    var regExp = /\(([^)]+)\)/;
    var matches = regExp.exec(sel.classList.value);
    var res_type = matches[1];
  
    // create a new field, associate it with a variable (new_field_block), assign it the correct data-index attr
    add_field(new_field_type, res_type, available_skos_vocabularies);
    const new_field_block = $('.sortable .block_field:last-child');
    var new_field_block_idx = new_field_block.attr('data-index');
    new_field_block.attr('data-index', preserve_data_index);
  
    // get the sections of the substited field to preserve previously inserted values 
    // (e.g.: Display name, RDF property, etc.) based on common labels, i.e. common inputs.
    // each input field is associated with a section and a label.
    const previous_field_sections = block_field.find("> section"); 
    const previous_field_labels = previous_field_sections.map(function() {
        return $(this).find("label:first-child").text();
    }).get();
    
    // check the elements which make up the input fields of the new field:
    // in case the element (the section's label) already exists in the substituted field, reuse it
    // otherwise, keep the new input fields and associate them with the right index and identifier
    new_field_block.find("section, a, label").each(function() {
        const label = $(this).find("label:first-child").text();
        const index = previous_field_labels.indexOf(label);
        console.log(index, label);
        if (index !== -1 && index !== 0) {
            // N.B.: index = -1 means that an input field included in the original field form is not included in the new one.
            // N.B.: index = 0 refers to the <select> element for changing field type. If included it would show the previous field value.
            const replacementSection = previous_field_sections.eq(index).clone();
            $(this).replaceWith(replacementSection);
        } else {
            // fix the id/name attributes of the main sections (i.e. $('section.row'))
            var new_section_id = $(this).attr('id');
            var previous_id = new_section_id.replace(new_field_block_idx, preserve_data_index);
            $(this).attr('id', previous_id);
            $(this).attr('name', previous_id);
        
            // fix the id/name attributes of nested elements
            $(this).find('[id^="' + new_field_block_idx + '__"]').each(function() {
            const newId = $(this).attr('id').replace(new_field_block_idx + '__', preserve_data_index + '__');
            if (newId.split("__").length === 3) {
                const updatedId = newId.replace(newId.split("__")[2], temp_id);
                $(this).attr('id', updatedId);
            } else {
                $(this).attr('id', newId);
            }
        });
  
        $(this).find('[name^="' + new_field_block_idx + '__"]').each(function() {
            const newName = $(this).attr('name').replace(new_field_block_idx + '__', preserve_data_index + '__');
            if (newName.split("__").length === 3) {
                const updatedName = newName.replace(newName.split("__")[2], temp_id);
                $(this).attr('name', updatedName);
            } else {
                $(this).attr('name', newName);
            }
        });
  
      }
    });
  
    block_field.replaceWith(new_field_block);
};

// if value == literal add disambiguate checkbox
function add_disambiguate(temp_id, el) {
    var field_disambiguate = "<section class='row'>\
      <label class='left col-11' for='disambiguate__"+temp_id+"'>Use this value as primary label (e.g. book title)</label>\
      <input class='disambiguate' onClick='disable_other_cb(this)' type='checkbox' id='disambiguate__"+temp_id+"' name='disambiguate__"+temp_id+"'>\
      </section>";
  
    var field_browse = "<section class='row'>\
      <label class='left col-11' for='browse__"+temp_id+"'>Use this value as a filter in <em>Explore</em> page</label>\
      <input type='checkbox' id='browse__"+temp_id+"' name='browse__"+temp_id+"'>\
    </section>";
  
    if (el.value == 'Literal') {
        $("input[id*='browse__"+temp_id+"']").parent().remove();
        $(el).parent().parent().append(field_disambiguate);
        updateindex();
        moveUpAndDown() ;
    } else if (el.value == 'URI' || el.value == 'URL') {
        if ($("input[id*='disambiguate__"+temp_id+"']") != undefined) {
            $("input[id*='browse__"+temp_id+"']").parent().remove();
            $("section[id*='addons__"+temp_id+"']").after(field_browse);
            $("input[id*='disambiguate__"+temp_id+"']").parent().remove();
        } else { $("section[id*='addons__"+temp_id+"']").after(field_browse); }
  
        // YASQE editor for SPARQL query patterns
        /* if (el.value == 'URI') {
            var field_SPARQL_constraint = $("<section class='row'>\
                <label class='col-md-3'>SPARQL CONSTRAINTS <br><span class='comment'>select a service to modify, or add a constraint (optional)</span></label>\
                <select class='custom-select col-md-8' name='service__"+temp_id+"'>\
                    <option value='None'>Select a service</option>\
                    <option value='WD'>Wikidata</option>\
                    <option value='catalogue'>This catalogue SPARQL endpoint</option>\
                </select>\
            </section>");
            field_SPARQL_constraint.find('select').on('change', function() {
                // generate a SPARQL editor instance
                SPARQL_constraint_editor(el,this,temp_id);
            });
            $(el).parent().after(field_SPARQL_constraint);
        } */
  
        updateindex();
        moveUpAndDown() ;
    } else if (el.value == 'Place') {
        $("input[id*='disambiguate__"+temp_id+"']").parent().remove();
        $("input[id*='browse__"+temp_id+"']").parent().remove();
        $("section[id*='addons__"+temp_id+"']").after(field_browse);
        updateindex();
        moveUpAndDown();
    }
  
};
  
// if one disambiguate is checked, disable others
function disable_other_cb(ckType) {
    var ckName = document.getElementsByClassName('disambiguate');
    var checked = document.getElementById(ckType.id);

    if (checked.checked) {
        for(var i=0; i < ckName.length; i++){
            ckName[i].checked = false;
            // if(!ckName[i].checked){ ckName[i].disabled = true; }
            // else{ ckName[i].disabled = false;}
        }
        checked.checked = true;
    }
    else {
        for(var i=0; i < ckName.length; i++){
            ckName[i].disabled = false;
        }
    }

    // make the field mandatory
    var mandatory_checkbox_id = ckType.id.replace("disambiguate", "mandatory");
    console.log(mandatory_checkbox_id)
    $('#'+mandatory_checkbox_id).prop('checked', true); 
};

// make hidden fields recognisable
function hide_field(el) { 
    var checked = document.getElementById(el.id);
    if (checked.checked == true) {
      $("#"+el.id).closest('.block_field').css('opacity', 0.6);
    } else {
      $("#"+el.id).closest('.block_field').css('opacity', 1);
    }
}


////////////////
/// SPECIFIC ///
////////////////

// SUBTEMPLATE FIELDS

// generate a list of checkboxes to select one or more values
function generateCheckboxes(templatesObject, fieldId) {
    let result = "";
    for (const templateObj of templatesObject) {
        var id = templateObj.short_name;
        var fullId = "template-"+ id + "__" + fieldId;
        var label = "<label for='"+fullId+"'>";
        var openTemplate = "<a target='_blank' href='/template-"+id+"'><i class='fas fa-external-link-alt'></i></a>  " + templateObj.name.toUpperCase();
        var input = "<input type='checkbox' id='"+fullId+"' name='"+fullId+"' value='"+templateObj.template+"'></label><br>";
        result += label + openTemplate + input;
    }
    result += "<label class='add-option'>CREATE NEW TEMPLATE <i class='fas fa-plus-circle' onclick='addTemplate(subtemplate=this)'></i></label>"
    return result;
}

// TEXTBOX > ENTITY FIELDS

// generate an instance of the YASQE editor to introduce a new SPARQL query constraint
function SPARQL_constraint_editor(field,el,temp_id,reset=false) {
    var select_input = $(el);
    let endpoint = "";
    let value_to_set = "";
    var selected_option = select_input.val();
  
    // hide existing YASQE editors
    $(el).parent().find('div[id*="'+temp_id+'"]').hide();
  
  
    // set the editor parameters based on the selected service:
    // no service selected
    if (selected_option === 'None') {
        return null
    }
    // wikidata
    if (selected_option === 'WD') {
        endpoint = wikidataEndpoint;
        var id = $(field).attr('id').split('__')[0] + '__wikidataConstraint__' + temp_id;
        if ($('[name="'+id+'"]').length>0 && reset==false) {
            value_to_set = $('[name="'+id+'"]').val().replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');;
        } else {
            value_to_set = `SELECT ?item ?itemLabel ?itemDescription WHERE {
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P106 wd:Q2526255 .
      SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:endpoint "www.wikidata.org";
            wikibase:api "EntitySearch";
            mwapi:search "insertQueryTerm";
            mwapi:language "en". #choose language
          ?item wikibase:apiOutputItem mwapi:item.
      }
      SERVICE wikibase:label {bd:serviceParam wikibase:language "en".}
  }`
        }
    }
    // catalogue 
    if (selected_option === 'catalogue') {
        endpoint = myPublicEndpoint
        var id = $(field).attr('id').split('__')[0] + '__catalogueConstraint__' + temp_id;
        if ($('[name="'+id+'"]').length>0 && reset==false) {
            value_to_set = $('[name="'+id+'"]').val().replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll(/&quot;/g, '"');;
        } else {
            value_to_set = `PREFIX bds: <http://www.bigdata.com/rdf/search#> 
  SELECT DISTINCT * WHERE { 
    ?item rdfs:label ?itemLabel . 
    ?item rdf:type ?itemClass .
    ?itemLabel bds:search "insertQueryTerm*" . 
    OPTIONAL { ?item rdfs:comment ?desc } . 
  }`
        }
    };
  
    var cls = selected_option + "_" + id;
    // retrieve the previously created yasqe editor if available else create a new one
    if ($('.'+cls).length > 0) {
        $('.'+cls).show();
    } else { 
        // set the HTML environment for the YASQE editor and add buttons
        var field_constraints = $("<div class='col-md-12 "+cls+"' id='yasqe_"+cls+"'></div>");
        var button_save = $("<span class='comment'>Save constraint: <i class='fas fa-save'></i></span>");
        var button_delete = $("<span class='comment'>Remove constraint: <i class='far fa-trash-alt'></i></span>");
        var button_reset = $("<span class='comment'>Reset constraint: <i class='fas fa-redo'></i></span>");
        var button_help = $("<span class='comment'>Help: <i class='far fa-lightbulb'></i></span>");
  
        // save the SPARQL constraint on click
        button_save.find('i').on('click', function() {
            // generate an hidden input to store the query constraints:
            // retrieve the query from the YASQE editor and set it as the value of the hidden input
            var value = yasqe_to_hidden_field(this, keep=true);
  
            // modify the hidden input in case it already exists else create a new one
            if ($('[name="'+id+'"]').length >0) {
                $('[name="'+id+'"]').val(value);
            } else {
                const new_hidden_field = $("<textarea class='hiddenInput' style='display: none;' name='"+id+"'></textarea>");
                new_hidden_field.val(value);
                select_input.after(new_hidden_field);
            }
            // reset the dropdown to its first option ('value="None"')
            select_input.find('option:first').prop('selected', true);
        });
  
        // delete the SPARQL constraint on click
        button_delete.find('i').on('click', function() {
            $(this).parent().parent().parent().remove();
            $('[name="'+id+'"]').remove();
        });
  
        // refresh the SPARQL constraint and get back to the default value
        button_reset.find('i').on('click', function() {
            $(this).parent().parent().parent().remove();
            $('[name="'+id+'"]').remove();
            SPARQL_constraint_editor(field,el,temp_id,reset=true);
        });
  
        // get some tips
        button_help.find('i').on('click', function() {
            var buttonsDiv = $(this).parent().parent();
            var goBackButton = $("<span class='comment'>Go back to editor: <i class='fas fa-undo'></i></span>");
            goBackButton.find('i').on('click', function() {
                $('.tips-div').remove();
                buttonsDiv.find('span').show();
                $(this).parent().remove();
            })
            buttonsDiv.find('span').hide();
            buttonsDiv.append(goBackButton);
    
    
            // create a new div to show the tips and anchor it to the .yasqe div
            const yasqeObj = $(this).parent().parent().prev();
            var offset = yasqeObj.offset();
            var left = offset.left;
            var top = offset.top;
            var width = yasqeObj.width()+1;
            var height = yasqeObj.height();
    
            const newDiv = $('<div class="tips-div" data-target="yasqe_'+cls+'"></div>');
            newDiv.css({
                left: left+"px",
                top: top+"px",
                width: width+"px",
                height: height+"px",
                position: "absolute",
                "z-index": "5",
                "background-color": "white",
                border: "1px solid #D1D1D1",
            })
    
            // retrieve the tips
            $.getJSON("./static/json/help.json", function(data) {
                const wikidataTipsObj = data.wikidataConstraint;
                $.each(wikidataTipsObj, function(pageNumber, pageContent) {
        
                    // create a clone of the model div and populate it with HTML content
                    let cloneDiv = newDiv.clone();
                    cloneDiv.html(pageContent);
        
                    // set the clone div attributes and css properties
                    $(cloneDiv).attr('data-number', pageNumber.replace('page',''));
                    if (pageNumber !== 'page1') {
                        $(cloneDiv).hide();
                    } else {
                        $(cloneDiv).addClass('active-page');
                    }
                    $('body').append(cloneDiv);
            });
    
            $('.tips-div[data-target="yasqe_'+cls+'"]').each(function() {
                var prevButton = $('<i class="fas fa-caret-left"></i>');
                var nextButton = $('<i class="fas fa-caret-right"></i>');
    
                // previous page
                prevButton.on('click', function() {
                var currentPage = $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').attr('data-number');
                var newPageNumber = parseInt(currentPage)-1;
                var targetPage = $('.tips-div[data-target="yasqe_'+cls+'"][data-number="'+newPageNumber+'"]');
                $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').hide();
                $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').removeClass('active-page');
                targetPage.show();
                targetPage.addClass('active-page');
                });
    
                // next page
                nextButton.on('click', function() {
                console.log('c')
                var currentPage = $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').attr('data-number');
                console.log(currentPage)
    
                var newPageNumber = parseInt(currentPage)+1;
                var targetPage = $('.tips-div[data-target="yasqe_'+cls+'"][data-number="'+newPageNumber+'"]');
                $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').hide();
                $('.tips-div.active-page[data-target="yasqe_'+cls+'"]').removeClass('active-page');
                targetPage.show();
                targetPage.addClass('active-page');
                });
                
                if ($(this).prev('div').length>0) {
                    $(this).append(prevButton)
                };
                if ($(this).next('div').length>0) {
                    $(this).append(nextButton)
                };
            })
    
            });
    
        });
        // end of tips section
  
        select_input.after(field_constraints);
  
        // complete the creation of the YASQE editor
        var yasqe = YASQE(document.getElementById("yasqe_"+cls), {
            sparql: {
            showQueryButton: false,
            endpoint: endpoint,
            }
        });
        yasqe.setValue(value_to_set);
        $('.'+cls).append('<div class="yasqe-buttons"></div>');
        $('.'+cls+' .yasqe-buttons').append(button_save, button_delete, button_reset, button_help);
    }
}


// SKOS Thesauri

// add_SKOS_vocab: allow users to add a new SKOS vocabulabury with sparql endpoint

function add_skos_vocab(element) {
    $(element).closest('label').hide(); // remove the button "Add a new vocabulary"
  
    // generate the form
    var form = "<section class='row skos_vocab_generator'>\
    <label class='col-md-3'><span class='comment'>label for the new vocabulary</span></label>\
    <input type='text' id='vocabLabel' class='col-md-8' placeholder='e.g.: Example-label'></input>\
    </section>\
    <section class='row skos_vocab_generator'>\
    <label class='col-md-3'><span class='comment'>vocabulary's webpage</span></label>\
    <input type='text' id='vocabUrl' class='col-md-8' placeholder='e.g.: https://exampleSKOS.org'></input>\
    </section>\
    <section class='row skos_vocab_generator'>\
    <label class='col-md-3'><span class='comment'>SPARQL query to get a label (?label) and a uri (?uri) for each vocable</span></label>\
    <div id='yasqe' style='margin-left:1em; width: 66.7%'></div>\
    </section>\
    <section class='row skos_vocab_generator'>\
    <label class='col-md-3'><span class='comment'>SPARQL query endpoint</span></label>\
    <input type='text' id='vocabEndpoint' placeholder='e.g.: https://exampleSKOS.org/sparql#' class='col-md-8'></input>\
    </section>\
    <section class='row skos_vocab_generator'>\
    <label class='col-md-3'></label>\
    <input id='save_skos' class='btn btn-dark' style='margin-left:20px' value='Add Vocabulary' onClick='save_vocab(this)'>\
    </section>"
    $(element).closest('.row').after(form);
    var yasqe = YASQE($('section.skos_vocab_generator #yasqe'), {
        sparql: {
            showQueryButton: false,
            endpoint: myPublicEndpoint,
        }
    });
    yasqe.setValue("SELECT DISTINCT ?label ?uri \nWHERE {?uri ?p ?label} \nLIMIT 10");
    yasqe.setSize(width='100%',height='200px');
}
  
function save_vocab(element) {
    // access the section containing the list of available vocabularies
    var $blockField = $(element).closest(".block_field");
    var $vocabsSection = $blockField.find(".skos_vocab_generator").eq(0).prev("section").find("section");
  
    // extract a label, a url, a query, and an endpoint to store a new vocab
    var label = $blockField.find('#vocabLabel').val();
    var url = $blockField.find('#vocabUrl').val();
    var query = yasqe_to_hidden_field($(element), true);
    var endpoint = $('#vocabEndpoint').val();

    // combine the pieces of information together and check whether some info is missing
    var infoArray = [label, url, query, endpoint];
    if (check_input_form(infoArray)) return null;
  
    // get the number of available vocabs (defined in template.html as a string)
    var vocabCount = available_skos_vocabularies.split("//").length + 1;
    available_skos_vocabularies += `//${label}`;

    // get the 'for' attribute of the label for the first vocab of the list (e.g.: "vocab6__1690443665556") 
    // to retrieve the id number of the field (e.g.: "1690443665556")
    var $firstLabel = $vocabsSection.find("label").eq(1);
    var tempIdList = $firstLabel.attr('for')?.split("__") || [];
    var tempId = tempIdList[tempIdList.length - 1] || "unknown";

    // get the index of the field in the template
    var idx = parseInt($firstLabel.attr('id')) || 0;
    console.log(vocabCount, tempId, idx);
  
    // generate a new checkbox to select the vocabulary and add it at the end of the list
    var newVocab = `
        <label class='newVocab' for='vocab${vocabCount}__${tempId}'>
            ${label.toUpperCase()}
            <input type='checkbox' id='${idx}__skos${vocabCount}__${tempId}' 
                   name='${idx}__skos${vocabCount}__${tempId}' 
                   value='${infoArray.join("__")}' checked>
        </label><br>
    `;
    $vocabsSection.children().last().prev().after(newVocab);
  
    // delete the form
    $('.skos_vocab_generator').remove(); 
    $('.add_vocabulary_button').show();
};

function check_input_form(input_array) {
    // check the name of the newly imported vocabulary (available_skos_vocabularies is defined in template.html)
    if (available_skos_vocabularies.toUpperCase().split("//").includes(input_array[0].toUpperCase())) {
        alert('A vocabulary named '+input_array[0]+' already exists: choose a new label');
        return true;
    } 
    // check missing information
    for (let i=0; i<input_array.length; i++) {
        if (input_array[i] == "") {
            var missing_datum = $('.skos_vocab_generator').eq(i).find('.comment').eq(0).text();
            alert('Insert a '+ missing_datum);
            return true;
        } 
    }
};

function yasqe_to_hidden_field(el,keep=false) {
    let value = '';
    var yasqe_div = $(el).parent().parent().parent();
    var yasqe_lines = yasqe_div.find('.CodeMirror-code>div');
    yasqe_lines.each(function() {
        var tokens = $(this).find('pre span span');
        tokens.each(function() {
            if (!$(this).hasClass('cm-ws')) {
                value+= $(this).text();
            } else {
                value+=' ';
            }
        });
        value += '\n';
    });
    if (keep===false){ yasqe_div.remove(); }
    return value
}

// Subclass 
function addLabelURI(btn,fieldId) {
    var block = $("<li class='col-md-12'><hr>\
    <section>\
        <section class='row col-md-6' style='display: inline-block'>\
            <label class='inner-label col-md-12'>Label</label>\
            <input type='text' id='label' class='col-md-12 align-self-start' name='label'>\
        </section>\
        <section class='row col-md-6' style='display: inline-block'>\
            <label class='inner-label col-md-12'>URI</label>\
            <input type='text' id='uri' class='col-md-12 align-self-start' name='uri'>\
        </section>\
        <button class='btn btn-dark' type='button' onclick='saveLabelURI(this,\""+fieldId+"\")'>Save value</button>\
    </section></li>");
    $(btn).closest('li').replaceWith(block);
}

function modifyLabelURI(btn,fieldId) {
    // retrieve previously provided values
    var ul = $(btn).closest("ul");
    var li = $(btn).closest("li");
    var inputElement = li.find("input");
    var uri = inputElement.val().split(",")[0];
    var label = inputElement.val().split(",")[1];
    var currentFieldId = $(btn).closest("section.block_field").data("id");

    // checks whether any value is being defined
    const isModifyFormActive = $(ul).find('li:last-child section').length > 0;
    if (isModifyFormActive) {
        showErrorPopup("Value currently being defined", "Save the value before proceeding.");
        return false;
    }

    // create new input fields
    var block = $("<li class='col-md-12'><hr>\
    <section>\
        <section class='row col-md-6' style='display: inline-block'>\
            <label class='inner-label col-md-12'>Label</label>\
            <input type='text' id='label' class='col-md-12 align-self-start' name='label'>\
        </section>\
        <section class='row col-md-6' style='display: inline-block'>\
            <label class='inner-label col-md-12'>URI</label>\
            <input type='text' id='uri' class='col-md-12 align-self-start' name='uri'>\
        </section>\
        <button class='btn btn-dark' type='button'>Save value</button>\
    </section></li>");
    block.find("#label").val(decodeURIComponent(label));
    block.find("#uri").val(decodeURIComponent(uri));
    block.find("button").on("click", function() {
        var isSubclassField = ul.attr("id").split("__").includes("subclass")
        var modifySubclass = isSubclassField ? uri : null 
        saveLabelURI(this,fieldId,modifySubclass);
    })

    // replace the "add new value" button and remove li
    ul.find("li:last-of-type").replaceWith(block);
    delete subclasses[uri];
    li.remove();
}

function removeLabelURI(btn) {
    console.log(btn)
    var ul = $(btn).closest("ul");
    var li = $(btn).closest("li");
    var inputElement = li.find("input");
    var uri = inputElement.val().split(",")[0];
    var label = inputElement.val().split(",")[1];
    var currentFieldId = $(btn).closest("section.block_field").data("id");

    if (ul.attr("id").split("__").includes("subclass")) {
        const swalWithBootstrapButtons = Swal.mixin({
            customClass: {
              confirmButton: "btn btn-dark",
              cancelButton: "btn btn-dark delete"
            },
            buttonsStyling: false
        });
        swalWithBootstrapButtons.fire({
            title: "Are you sure?",
            text: "To avoid inconsistencies, corresponding triples will be deleted. Do you want to proceed?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete it!",
            cancelButtonText: "No, cancel!",
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                swalWithBootstrapButtons.fire({
                    title: "Deleted!",
                    text: "Your data has been updated.",
                    icon: "success"
                });
                $.ajax({
                    type: 'GET',
                    url: $(location).attr('href') + `?action=updateSubclass&update=delete&olduri=${encodeURIComponent(uri)}`,
                    success: function(data) {
                        console.log("success")
                        delete subclasses[uri];
                        li.remove();
                        updateSubclassRestrictionField(currentFieldId);
                    }
                });
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                swalWithBootstrapButtons.fire({
                    title: "Cancelled!",
                    text: "Your data has been preserved.",
                    icon: "error"
                });
                updateSubclassRestrictionField(currentFieldId);

            }
        });
    } else {
        li.remove();
    }
}

function saveLabelURI(btn,fieldId,modifySubclass=null,otherSubclass=null) {
    // save input values then update the list
    console.log(modifySubclass)
    var ul = $(btn).closest("ul"); 
    var block = $(btn).closest("li");
    var label = block.find("#label").val();
    var uri = block.find("#uri").val();
    var index = ul.find("li").length;

    // check input values
    if (label === "") {
        showErrorPopup("Invalid label", "Please, provide a label");
        return false;
    }   else if (uri === "") {
        showErrorPopup("Invalid URI", "Please, provide a URI");
        return false;
    } 
    else if (uri in subclasses && uri !== modifySubclass) {
        // alert in case the uri is already in use, except for subclass value modifying
        showErrorPopup("Invalid URI", "This URI is already in use. Please, provide a new one");
        return false;
    }

    // modify a Subclass value if required 
    if (modifySubclass && uri !== modifySubclass) {
        console.log(modifySubclass, uri)
        const swalWithBootstrapButtons = Swal.mixin({
            customClass: {
                confirmButton: "btn btn-dark",
                cancelButton: "btn btn-dark delete"
            },
            buttonsStyling: false
        });
        swalWithBootstrapButtons.fire({
            title: "Are you sure?",
            text: "To avoid inconsistencies, corresponding triples will be updated. Do you want to proceed?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, update it!",
            cancelButtonText: "No, cancel!",
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                swalWithBootstrapButtons.fire({
                    title: "Deleted!",
                    text: "Your data has been updated.",
                    icon: "success"
                });
                // Update data based on the new URI
                $.ajax({
                    type: 'GET',
                    url: $(location).attr('href') + `?action=updateSubclass&update=modify&olduri=${encodeURIComponent(modifySubclass)}&newlabel=${encodeURIComponent(label)}&newuri=${encodeURIComponent(uri)}`,
                    success: function(data) {
                        var previouslySelectedFields = $("input[type='checkbox']:checked[value='"+encodeURIComponent(modifySubclass)+"']").closest(".block_field");
                        storeLabelURI(index, fieldId, uri, label, ul, block);
                        previouslySelectedFields.find(".subclass li:last-of-type input").prop("checked", true);
                    }
                });
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                swalWithBootstrapButtons.fire({
                    title: "Cancelled!",
                    text: "Your data has been preserved.",
                    icon: "error"
                });
            }
        });
    } else {
        storeLabelURI(index, fieldId, uri, label, ul, block);
    }
}

// add an hidden input field to the DOM to store the new value
function storeLabelURI(index, fieldId, uri, label, ul, block) {
    var hiddenInputId = "value"+parseInt(index)+"__"+fieldId;
    ul.append($("<li>\
        <label>"+label+" <i class='far fa-edit' onclick='modifyLabelURI(this)'></i> <i class='far fa-trash-alt' onclick='removeLabelURI(this)'></i></label>\
        <input type='hidden' id='"+hiddenInputId+"' name='"+hiddenInputId+"' value='"+uri+","+label+"'/>\
    </li>\
    <li>\
        <label class='add-option'>ADD NEW VALUE <i class='fas fa-plus-circle' onclick='addLabelURI(this, \""+fieldId+"\")'></i></label>\
    </li>"));
    block.remove();

    // add an option for subclass restriction in case a new subclass value has been defined
    if (ul.attr("id").split("__").includes("subclass")) {
        subclasses[uri] = label;
        var currentIndex = ul.closest("section.block_field").data("id");
        updateSubclassRestrictionField(currentIndex);
    }
    updateindex();

}

// subclass list update
function updateSubclassRestrictionField(currentIndex,obj=null,showOther=null) {

    // generate currentIndex when modifying "Other" option
    currentIndex = currentIndex != "" ? currentIndex : $(obj).closest("section.block_field").data("id");
    if (showOther === true) {
        subclasses["other"] = "Other";
    } else if (showOther === false) {
        delete subclasses["other"];
    }

    // modify input fields "subclass restriction" options
    $(".block_field").each(function() {
        var tempId = $(this).data("id");
        if (tempId !== currentIndex) {
            let selectedValues = [];
            var subclassRestrictionSection = $(this).find(".subclass");
            if (subclassRestrictionSection.length > 0) {
                // find previously selected values
                selectedValues = subclassRestrictionSection.find("input[type='checkbox']:checked")
                    .map(function () {
                        return $(this).val();
                    }).get();
                subclassRestrictionSection.remove();
            }

            // prepare the new checkbox section then check previously selected values
            var fieldSubclassRestriction = $(`<section class='subclass row'>
                <label class='col-md-3'>SUBCLASS RESTRICTED <br><span class='comment'>make this field available once a subclass has been selected</span></label>
                <section class='col-md-8'>
                    <ul>
                        <li><label class='inner-label col-md-12'>Subclasses List</label></li>
                        ${Object.entries(subclasses).map(([uri, label], index) => `
                            <li><label for='subclass${index}__${tempId}'>${label}</label> <input type='checkbox' value='${encodeURIComponent(uri)}' name='subclass${index}__${tempId}'></li>
                        `).join('\n')}
                    </ul>
                </section>
            </section>`);
            selectedValues.forEach(element => {
                fieldSubclassRestriction.find("[value='"+element+"']").prop("checked", true);
            });

            var lastInputField = $(this).find(".col-md-3:first-child").last();
            var lastInputRow = lastInputField.closest(".row");
            var newId = $(this).data("index")+"__restricted__"+$(this).data("id");
            fieldSubclassRestriction.find("select").attr("name", newId);
            fieldSubclassRestriction.find("select").attr("id", newId);
            lastInputRow.after(fieldSubclassRestriction);
        }
    });
    updateindex();

}



///////////////////
////// TODO //////
//////////////////

function editSubtemplate(newSubtemplateButton) {
    var className = $("input[name='class_name']").val();
    var shortName = className.toLowerCase().replaceAll(" ", "_");
    var nextUrl = "/template-" + shortName;
    var classUriInputs = $('#uri-container').find('input');
    var classUri = '';

    classUriInputs.each(function(index,element) {
        let new_class = "&uri_class_" + index + "=" + encodeURIComponent($(element).val()); 
        classUri += new_class;
    });
    $.ajax({
        type: 'POST',
        url: '/welcome-1?action=createTemplate'+classUri+'&class_name='+encodeURIComponent(className),
        success: function(data) {
            setTimeout(function() { window.open(nextUrl, "_blank") }, 500);
        }
    });

    // create a checkbox for each Subtemplate field
    $(".import-section").each(function() {
        var blockField = $(this).closest(".block_field");
        var blockFieldId = blockField.data("id");
        var blockFieldIndex = blockField.data("index");
        var fullId = blockFieldIndex+"__"+shortName+"__"+blockFieldId;
        var labelElement = "<label for='"+fullId+"'>\
            <a target='_blank' href='"+nextUrl+"'><i class='fas fa-external-link-alt'></i></a>  " + className.toUpperCase() + "\
            <input type='checkbox' id='"+fullId+"' name='"+fullId+"' value='"+encodeURIComponent('resource_templates/'+nextUrl)+".json'></label><br>";
        blockField.find("label:last-child").before($(labelElement));
    });

    // activate the checkbox
    console.log($(newSubtemplateButton),$(newSubtemplateButton).parent().prev(),$(newSubtemplateButton).parent().prev().find("input"))
    $(newSubtemplateButton).parent().prev().prev().find("input").prop("checked",true);

    // remove input elements and close modal
    $('#uri-container').empty();
    $("input[name='class_name']").val("");
    $("#selectTemplateClassModal").toggleClass('open-modal');
    $("body div.modal-bg").remove();

    // add the novel template to the Array
    var newTemplate = { 
        name : className,
        short_name : shortName,
        template : "resource_templates/" + nextUrl + ".json" 
    }
    templatesObject.push(newTemplate);
}