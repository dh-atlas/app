/* charts.js
----------------------------- 
this file collects all the js functions needed 
to create or modify explorative charts
*/

$(document).ready(function() {

    // set the base URL for backend queries
    let pageUrl = new URL(window.location.href);
    let baseUrl = pageUrl.origin + pageUrl.pathname.substring(0, pageUrl.pathname.lastIndexOf('/'));

    // check section is in viewport (see window.on('scroll') below)
    function isElementInViewport(el) {
        var rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 && 
            rect.left >= 0
        );
    }

    // show section on scroll
    $(window).on('scroll', function() {
        $('.section-fade').each(function() {
            // activate animation
            if (isElementInViewport(this)) {
                $(this).addClass('section-fade-visible');
            }
        });
    });
    $(window).trigger('scroll'); // for sections already visibile when the page is loaded

    // get data and generate counters
    $(".counters").each(function() {
        var chartInfo = $(this).find("script[type='application/json']").html();
        var $currentCounter = $(this); 

        // get data from the back-end api
        $.ajax({
            type: 'POST',
            url: baseUrl+'/charts-visualization?action=getData',
            data: chartInfo,
            contentType: 'application/json',
            dataType: 'json',
            success: function(jsondata) {
                console.log(jsondata);
                jsondata.forEach(function(element, index) {
                    var $counterElement = $currentCounter.find("p.counterNum").eq(index);
                    
                    // set the animation
                    var startValue = 0;
                    var endValue = element;
                    var duration = 2000;
                    var stepTime = 50;
    
                    var steps = duration / stepTime;
                    var increment = (endValue - startValue) / steps;
    
                    var currentValue = startValue;
                    var counter = setInterval(function() {
                        currentValue += increment;
                        if (currentValue >= endValue) {
                            currentValue = endValue;
                            clearInterval(counter); // stop the animation
                        }
                        $counterElement.text(Math.round(currentValue)); // update number
                    }, stepTime);
                });
            }
        });
    });
    

    // get data and generate charts
    $(".chart-body").each(function() {
        var chartId = $(this).attr("id");
        var chartInfo = $("#"+chartId+"_data").html();
        
        // get data from the back-end api
        $.ajax({
            type: 'POST',
            url: baseUrl+'/charts-visualization?action=getData',
            data: chartInfo,
            contentType: 'application/json',
            dataType: 'json',
            success: function(jsondata) {
                chartInfo = JSON.parse(chartInfo);       
                if (chartInfo["type"] == "map") {
                    if (chartInfo["mapType"] === "common-map") {
                        map(chartId,jsondata)
                    } else {
                        mapDrillDown(chartId,jsondata)
                    }
                } else if (chartInfo["type"] == "chart") {
                    var chartOptions = chartInfo["info"];

                    if (chartInfo["chartType"] == "bar") {
                        if (chartInfo["y-var"] == "?label") { invertedBarchart(chartOptions[0],chartOptions[1],chartOptions[2],jsondata) }
				        else if (chartInfo["x-var"] == "?label") { barchart(chartOptions[0],chartOptions[1],chartOptions[2],jsondata) }
                    } else if (chartInfo["chartType"] == "pie") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=false,semi=false);
                    } else if (chartInfo["chartType"] == "donut") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=true,semi=false);
                    } else if (chartInfo["chartType"] == "semi-circle") {
                        piechart(chartOptions[0],chartOptions[1],chartOptions[2],chartInfo["legend"],jsondata,donut=false,semi=true);
                    }
                }
            }
        })
    })

    // generate preview
    // generate preview using event delegation
    $(document).on('click', '.preview', function(e) {
        e.preventDefault();
        var blockField = $(this).closest(".block_field");
        blockField.find(".charts-yasqe").each(function() {
            var query = getYASQEQuery($(this));
            var queryIdx = $(this).attr("id").split("__")[0];
            var queryId = queryIdx + "__query__" + queryIdx;
            blockField.append($("<input type='hidden' name='"+queryId+"' value='"+query+"'/>"));
            $(this).find("textarea").remove();
        });

        let pageUrl = new URL(window.location.href);
        let baseUrl = pageUrl.origin + pageUrl.pathname.substring(0, pageUrl.pathname.lastIndexOf('/'));
        var url = baseUrl+"/charts-visualization?action=preview";
        blockField.find('input, select').each(function() {
            url += "&" + encodeURIComponent($(this).attr("name")).replace(/'/g, '%27') + "=" + encodeURIComponent($(this).val()).replace(/'/g, '%27');
        });
        blockField.find('textarea').each(function() {
            url += "&" + encodeURIComponent($(this).attr("name")).replace(/'/g, '%27') + "=" + encodeURIComponent($(this).text()).replace(/'/g, '%27');
        });
        var modal = $("<div class='modal-previewMM'><span class='previewTitle'>This is a preview of your data visualization<br></span><span class='closePreview'></span><iframe src='" + url + "'></div>")
        $(this).after(modal);
    });

    // save the charts template
    $("#updateTemplate").on('click', function(e) {
        e.preventDefault();

        // resolve yasqe textarea
        $(".charts-yasqe").each(function() {
            var query = getYASQEQuery($(this));
            var queryIdx = $(this).attr("id").split("__")[0];
            var queryId = queryIdx + "__query__" + queryIdx;
            $("#chartForm").append($("<input type='hidden' name='"+queryId+"' value='"+query+"'/>"));
            $(this).find("textarea").remove();
        });

        // save the template in case everything is ok
        Swal.fire({ title: 'Saved!'});
        setTimeout(function() { document.getElementById("chartForm").submit();}, 500);
    });
});

/////////////////////
/// CONFIGURATION ///
/////////////////////

function generateYASQE(elementId,query=null) {
    console.log(elementId);
    var yasqe = YASQE(document.getElementById(elementId), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
    
    if (query) {
        query = query.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        yasqe.setValue(query);
    }
}

// add a new Visualization block to define a new Visualization
function addVisualization(visualizationType, changeIndex=null) {


    // get last visualization block index
    const lastVisualization = $(".sortable .block_field:last-child");
    var index = lastVisualization.data("index");

    // set the new block HTML code    
    var newIndex = changeIndex != null ? changeIndex : index + 1;
    var newFieldBlock = "<section class='block_field' data-index='"+newIndex+"'>\
        <section class='row'>\
            <label class='col-md-3'>TYPE</label>\
            <select onchange='changeVisualization(this)' class='col-md-8 custom-select' name='type__"+newIndex+"' id='type__"+newIndex+"'>\
                <option value='None'>Select a visualization type</option>\
                <option value='counter' "+is_selected('counter',visualizationType)+">Counter</option>\
                <option value='chart' "+is_selected('chart',visualizationType)+">Chart</option>\
                <option value='map' "+is_selected('map',visualizationType)+">Map</option>\
            </select>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>TITLE</label>\
            <input type='text' id='title__"+newIndex+"' class='col-md-8 align-self-start' name='title__"+newIndex+"'/>\
        </section>\
        <section class='row'>\
            <label class='col-md-3'>DESCRIPTION</label>\
            <textarea id='description__"+newIndex+"' class='col-md-8 align-self-start' name='description__"+newIndex+"'></textarea>\
        </section>";

    var countersLits = "<section class='row'>\
        <label class='col-md-3'>COUNTERS<br><span class='comment'>define one or multiple counters</span></label>\
        <section class='col-md-8'>\
            <ul class='col-md-12 charts-list' id='counters__"+newIndex+"'>\
                <li><label class='inner-label col-md-12'>Counters list</label></li>\
                <li><label class='add-option'>Add new counter <i class='fas fa-plus-circle' onclick='addCounter(this,\""+newIndex+"\")'></i></label></li>\
            </ul>\
        </section>\
    </section>";

    var chartType = "<section class='row'>\
        <label class='col-md-3'>CHART TYPE</label>\
        <select onchange='changeChart(this)' class='col-md-8 custom-select' name='chartType__"+newIndex+"' id='chartType__"+newIndex+"'>\
            <option value='None'>Select a chart type</option>\
            <option value='bar'>Bar Chart</option>\
            <option value='pie'>Pie Chart</option>\
            <option value='donut'>Donut Chart</option>\
            <option value='semi-circle'>Semi-circle Chart</option>\
        </select>\
    </section>";

    var chartYasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data (two variables required)</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newIndex+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var chartLegend = "<section class='row'>\
        <label class='left col-11' for='legend__"+newIndex+"'>Show legend</label>\
        <input type='checkbox' id='legend__"+newIndex+"' name='legend__"+newIndex+"'>\
    </section>";

    var mapType = "<section class='row'>\
        <label class='col-md-3'>MAP TYPE</label>\
        <select onchange='changeMapType(this)' class='col-md-8 custom-select' name='mapType__"+newIndex+"' id='mapType__"+newIndex+"'>\
            <option value='None'>Select a map type</option>\
            <option value='common-map'>Simple Map</option>\
            <option value='drilldown-map'>Drill-down Map</option>\
        </select>\
    </section>";

    var mapYasqeField = "<section class='row'>\
        <label class='col-md-3'>QUERY<br><span class='comment'>set a SPARQL query to retrieve data, where locations can be represented either as GeoNames entities or as latitude-longitude pairs</span></label>\
        <section class='col-md-8 align-self-start'>\
            <div id='yasqe-"+newIndex+"' class='col-md-12 charts-yasqe'></div>\
        </section>\
    </section>";

    var fieldButtons = "<a href='#' class='up'><i class='fas fa-arrow-up'></i></a> <a href='#' class='down'><i class='fas fa-arrow-down'></i></a> <a href='#' class='preview'><i class='fas fa-eye'></i></a> <a href='#' class='trash'><i class='far fa-trash-alt'></i></a>"

    // add Type related fields
    if (visualizationType === "counter") {
        newFieldBlock += countersLits ;
    } else if (visualizationType === "chart") {
        newFieldBlock += chartType + chartYasqeField + chartLegend ;
    } else if (visualizationType === "map") {
        newFieldBlock += mapType + mapYasqeField ;
    }
    
    newFieldBlock += fieldButtons + "</section>"
    // add the new block
    lastVisualization.after($(newFieldBlock));
    generateYASQE("yasqe-"+newIndex);

    if (changeIndex === null) {
        updateindex();
        moveUpAndDown();
    }
    
    $(".trash").click(function(e){
        e.preventDefault();
        $(this).parent().remove();
    });
}

// change visualization type
function changeVisualization(select) {
    var newViz = $(select).val();
    var currentIndex = $(select).closest(".block_field").data("index");
    
    addVisualization(newViz, currentIndex); // create a new viz block
    const newVizBlock = $(".sortable .block_field:last-child");
    const oldVizBlock = $(select).closest(".block_field");

    // check if required values have already been provided within the original viz block
    newVizBlock.find("input, select, textarea, .charts-yasqe").each(function() {
        var existingValues = oldVizBlock.find("[id*='__"+$(this).attr("id")+"']");
        if (existingValues.length > 0 && $(this).attr("id") !== undefined) {
            $(this).closest("section.row").replaceWith(existingValues.eq(0).closest("section.row"));
        }
    });

    // check the comment to the SPARQL input
    const commentSpan = newVizBlock.find(".charts-yasqe").closest(".row").find(".comment");
    if (newViz === "chart") { commentSpan.text("set a SPARQL query to retrieve data (two variables required)") }
    else if (newViz === "map") { commentSpan.text("set a SPARQL query to retrieve data, where locations can be represented either as GeoNames entities or as latitude-longitude pairs") }

    // move the new block to right position
    oldVizBlock.replaceWith(newVizBlock);
    updateindex();
    moveUpAndDown();
} 

/* CHARTS */
function changeChart(select) {
    var value = $(select).val();
    var index = $(select).attr("name").split("chartType__")[1];
    let newClass, firstVar, secondVar;
    if (value === "bar") {
        newClass = "chart-axes";
        firstVar = '<label class="col-md-3">X-AXIS<br><span class="comment">set the SPARQL variable to be shown in the X-Axis</span></label>';
        secondVar = '<label class="col-md-3">Y-AXIS<br><span class="comment">set the SPARQL variable to be shown in the Y-Axis</span></label>'
    } else if (["donut", "pie", "semi-circle"].includes(value)) {
        newClass = "chart-variables";
        firstVar = '<label class="col-md-3">1st VARIABLE<br><span class="comment">set a SPARQL variable</span></label>';
        secondVar = '<label class="col-md-3">2nd VARIABLE<br><span class="comment">set a SPARQL variable</span></label>';
    } else {
        newClass = null; firstVar = null; secondVar = null;
    }

    // remove existing fields then add new ones
    $(select).closest("section.block_field").find(".chart-axes, .chart-variables").remove();
    if (newClass !== null) {
        var chartAxes = "<section class='row "+newClass+"'>"+firstVar+"\
            <section class='col-md-3'>\
                <label class='inner-label'>SPARQL variable</label>\
                <input type='text' id='"+index+"__x-var__"+index+"' name='"+index+"__x-var__"+index+"'/>\
            </section>\
            <section class='col-md-3'>\
                <label class='inner-label'>Display name</label>\
                <input type='text' id='"+index+"__x-name__"+index+"' name='"+index+"__x-name__"+index+"'/>\
            </section>\
            <section class='col-md-2 center-checkbox'>\
                <label class='inner-label'>Sort by</label>\
                <input type='checkbox' id='"+index+"__x-sort__"+index+"' name='"+index+"__x-sort__"+index+"' onclick='sortChart('"+index+"')'/>\
            </section>\
        </section>\
        <section class='row "+newClass+"'>"+secondVar+"\
            <section class='col-md-3'>\
                <label class='inner-label'>SPARQL variable</label>\
                <input type='text' id='"+index+"__y-var__"+index+"' name='"+index+"__y-var__"+index+"'/>\
            </section>\
            <section class='col-md-3'>\
                <label class='inner-label'>Display name</label>\
                <input type='text' id='"+index+"__y-name__"+index+"' name='"+index+"__y-name__"+index+"'/>\
            </section>\
            <section class='col-md-2 center-checkbox'>\
                <label class='inner-label'>Sort by</label>\
                <input type='checkbox' id='"+index+"__y-sort__"+index+"' name='"+index+"__y-sort__"+index+"' onclick='sortChart('"+index+"')'/>\
            </section>\
        </section>";

        $(select).closest("section.row").next().after(chartAxes); // add new configuration input fields
    }
}

function sortChart(element, fieldId) {
    var isChecked = $(element).is(":checked");
    var checkboxes = $("[name*='sort__"+fieldId+"']");
    checkboxes.prop("checked", false);

    if (isChecked) {
        $(element).prop("checked", true);
    }
}

/* COUNTERS */
function addCounter(element, fieldId) {
    var block = $("<li class='col-md-12'><hr><section class='col-md-12'>\
        <section class='row'>\
            <label class='inner-label col-md-12'>New counter name</label>\
            <input type='text' id='description' class='col-md-12 align-self-start' name='description'>\
        </section>\
        <section class='row'>\
            <label class='inner-label col-md-12'>Query</label>\
            <div id='newYasqe' class='yasqe-max'></div>\
        </section>\
        <button class='btn btn-dark' type='button' onclick='saveCounter(this,\""+fieldId+"\")'>Save counter</button>\
    </section></li>");

    $(element).parent().parent().replaceWith(block);
    yasqe = YASQE(document.getElementById("newYasqe"), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
}

function saveCounter(element,fieldId,modify=false) {
    var item = $(element).closest("li");
    let itemIndex;

    // retrieve the label and the query
    if (modify) {
        itemIndex = modify
    } else {
        var itemsList = $(element).closest("ul");
        itemIndex = itemsList.find("li").length - 1;
    }
    var label = item.find("[name='description']").val();
    var query = getYASQEQuery(item);

    // make sure a label has been provided
    if (label === "") {
        label = fieldId+" - no label";
    }

    // add the new counter to the DOM and remove input fields
    item.after("<li>\
        <label>"+label+" <i class='far fa-edit' onclick='modifyCounter(this)'></i> <i class='far fa-trash-alt' onclick='removeCounter(this)'></i></label>\
        <input type='hidden' name='"+fieldId+"__counter"+itemIndex+"_"+label.replace(" ","_")+"__"+fieldId+"' value='"+query+"'/>\
    </li>\
    <li>\
        <label class='add-option'>Add new counter <i class='fas fa-plus-circle' onclick='addCounter(this, \""+fieldId+"\")'></i></label>\
    </li>");
    item.remove();

    // scroll top
    $('html, body').animate({
        scrollTop: itemsList.offset().top - 100
    }, 800);
}

function modifyCounter(element) {
    // retrieve counter's data
    const input = $(element).parent().next("input");
    var fieldId = input.attr("name").split("__")[0]
    var idx = input.attr("name").split("__")[1].split("_")[0].replace("counter","")
    var rawTitle = input.attr("name").split("__")[1].split("_");
    var title = rawTitle.slice(1, rawTitle.length).join(' ');
    var query = input.val()

    var block = $("<li class='col-md-12'><hr><section class='col-md-12'>\
        <section class='row'>\
            <label class='inner-label col-md-12'>New counter name</label>\
            <input type='text' id='description' class='col-md-12 align-self-start' name='description'>\
        </section>\
        <section class='row'>\
            <label class='inner-label col-md-12'>Query</label>\
            <div id='newYasqe' class='yasqe-max'></div>\
        </section>\
        <button class='btn btn-dark' type='button' onclick='saveCounter(this,\""+fieldId+"\",\""+idx+"\")'>Save counter</button>\
    </section></li>");
    
    $(block).find("input").val(title.replace("_"," "));
    $(element).closest("ul").find("li:last-of-type").replaceWith(block);
    $(element).closest("li").remove();
    yasqe = YASQE(document.getElementById("newYasqe"), {
        sparql: {
        showQueryButton: false,
        endpoint: myPublicEndpoint,
        }
    });
    yasqe.setValue(query);
    $('html, body').animate({
        scrollTop: block.offset().top - 100
    }, 800);
}

function removeCounter(element) {
    $(element).closest("li").remove();
} 


/////////////////////
/// VISUALIZATION ///
/////////////////////

// Charts (bar-chart, pie-chart, donut-chart, semicircle-chart)
function barchart(elid,data_x,data_y, data) {
    console.log(elid,data_x,data_y, data)
    am5.ready(function() {
    var root = am5.Root.new(elid);
    root.setThemes([ am5themes_Animated.new(root) ]);
    var chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX:true
    }));
    var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineY.set("visible", false);
    var xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
    xRenderer.labels.template.setAll({
        rotation: -30,
        centerY: am5.p50,
        centerX: am5.p100,
        paddingRight: 15,
        oversizedBehavior: "truncate",
        maxWidth: 120
    });

    var xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        maxDeviation: 0.3,
        categoryField: data_x,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
    }));

    var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
        maxDeviation: 0.3,
        renderer: am5xy.AxisRendererY.new(root, {})
    }));

    var series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: "Series 1",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: data_y,
        sequencedInterpolation: true,
        categoryXField: data_x,
        tooltip: am5.Tooltip.new(root, {
        labelText:"{valueY}"
        })
    }));

    series.columns.template.setAll({ cornerRadiusTL: 5, cornerRadiusTR: 5 });
    series.columns.template.adapters.add("fill", function(fill, target) {
        return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    series.columns.template.adapters.add("stroke", function(stroke, target) {
        return chart.get("colors").getIndex(series.columns.indexOf(target));
    });

    xAxis.data.setAll(data);
    series.data.setAll(data);
    series.appear(1000);
    chart.appear(1000, 100);
    });
};

function invertedBarchart(elid,data_x,data_y,data) {

    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);
        var chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panY",
            wheelY: "zoomY",
            pinchZoomX:true
        }));
        var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
        cursor.lineY.set("visible", false);
        var yRenderer = am5xy.AxisRendererY.new(root, {
            minGridDistance: 30,
            minorGridEnabled: true
        });
        yRenderer.labels.template.setAll({
            oversizedBehavior: "wrap",
            textAlign: "right",
            centerX: am5.p100,    
            maxWidth: 180,
            fontSize: 14       
        });
        
        yRenderer.grid.template.set("location", 1);
        
        var yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            maxDeviation: 0.3,
            categoryField: data_y,
            renderer: yRenderer,
            tooltip: am5.Tooltip.new(root, {})
        }));
        
        var xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            maxDeviation: 0.3,
            renderer: am5xy.AxisRendererX.new(root, {
                strokeOpacity: 0.1,
                minGridDistance: 80
        
            })
        }));
        
        var series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: "Series 1",
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: data_x,
            categoryYField: data_y,
            tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "left",
                labelText: "{valueX}"
            })
        }));
    
        series.columns.template.setAll({ cornerRadiusBR: 5, cornerRadiusTR: 5 });
        series.columns.template.adapters.add("fill", function(fill, target) {
            return chart.get("colors").getIndex(series.columns.indexOf(target));
        });
    
        series.columns.template.adapters.add("stroke", function(stroke, target) {
            return chart.get("colors").getIndex(series.columns.indexOf(target));
        });
    
        yAxis.data.setAll(data);
        series.data.setAll(data);
        series.appear(1000);
        chart.appear(1000, 100);
    });
};
  

function piechart(elid,data_x,data_y,legend,data,donut=false,semi=false) {
    console.log(data_x, data_y)
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
          am5themes_Animated.new(root),
        ]);
        
        var chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            ...(donut && { innerRadius: am5.percent(50) }), // donut-chart
            ...(semi && { startAngle: 180, endAngle: 360 }) // semicircle-chart
        }));
        
        
        var series = chart.series.push(am5percent.PieSeries.new(root, {
          valueField: data_y,
          categoryField: data_x,
          ...(semi && { startAngle: 180, endAngle: 360, alignLabels: false }) // semicircle-chart
        }));

        // semicircle-chart
        if (semi) {
            series.states.create("hidden", {
                startAngle: 180,
                endAngle: 180
            });
        }
        
        series.labels.template.setAll({
            wrap: true,    
            maxWidth: 140,
            oversizedBehavior: "wrap",
            fontSize: 14
        });
          

        series.slices.template.setAll({
            cornerRadius: 5
        });
        series.data.setAll(data);
        series.appear(1000, 100);

        if (legend==="True") {
            let legendDiv = chart.children.push(am5.Legend.new(root, {
                centerX: am5.percent(50),
                x: am5.percent(50),
                marginTop: 15,
                marginBottom: 15
            }));
            
            legendDiv.data.setAll(series.dataItems);
        }
    });
};



function map(elid, data) {

    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);
        var chart = root.container.children.push(
            am5map.MapChart.new(root, {
                panX: "rotateX",
                panY: "translateY",
                projection: am5map.geoMercator(),
            })
        );

        // set background 
        var backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
        backgroundSeries.mapPolygons.template.setAll({
            fill: root.interfaceColors.get("alternativeBackground"),
            fillOpacity: 0,
            strokeOpacity: 0
        });
        backgroundSeries.data.push({
            geometry: am5map.getGeoRectangle(90, 180, -90, -180)
        });

        var zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
        zoomControl.homeButton.set("visible", true);

        var polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow,
            exclude: ["AQ"]
        })
        );

        polygonSeries.mapPolygons.template.setAll({
            fill: root.interfaceColors.get("alternativeBackground"),
            fillOpacity: 0.15,
            strokeWidth: 0.5,
            stroke: root.interfaceColors.get("background")
        });
        var pointSeries = chart.series.push(am5map.ClusteredPointSeries.new(root, {}));

        pointSeries.set("clusteredBullet", function(root) {
            var container = am5.Container.new(root, {
                cursorOverStyle:"pointer"
            });

            var circle1 = container.children.push(am5.Circle.new(root, {
                radius: 8,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var circle2 = container.children.push(am5.Circle.new(root, {
                radius: 12,
                fillOpacity: 0.3,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var circle3 = container.children.push(am5.Circle.new(root, {
                radius: 16,
                fillOpacity: 0.3,
                tooltipY: 0,
                fill: am5.color(0xff8c00)
            }));

            var label = container.children.push(am5.Label.new(root, {
                centerX: am5.p50,
                centerY: am5.p50,
                fill: am5.color(0xffffff),
                populateText: true,
                fontSize: "8",
                text: "{value}"
            }));

            container.events.on("click", function(e) {
                pointSeries.zoomToCluster(e.target.dataItem);
            });

            return am5.Bullet.new(root, {
                sprite: container
            });
        });

        // Create regular bullets
        pointSeries.bullets.push(function() {
            var circle = am5.Circle.new(root, {
                radius: 6,
                tooltipY: 0,
                fill: am5.color(0xff8c00),
                tooltipText: "{title}"
            });

            return am5.Bullet.new(root, {
                sprite: circle
            });
        });

        for (var i = 0; i < data.length; i++) {
            var city = data[i];
            addCity(city["longitude"], city["latitude"], city["label"]);
        }

        function addCity(longitude, latitude, label) {
            console.log(longitude, latitude, label)
            pointSeries.data.push({
                geometry: { type: "Point", coordinates: [longitude, latitude] },
                title: label
            });
        }

        // Add globe/map switch
        var cont = chart.children.push(am5.Container.new(root, {
            layout: root.horizontalLayout,
            x: 20,
            y: 40
        }));
        
        cont.children.push(am5.Label.new(root, {
            centerY: am5.p50,
            text: "Map"
        }));
        
        var switchButton = cont.children.push(
            am5.Button.new(root, {
            themeTags: ["switch"],
            centerY: am5.p50,
            icon: am5.Circle.new(root, {
                themeTags: ["icon"]
            })
            })
        );
        
        switchButton.on("active", function () {
            if (!switchButton.get("active")) {
            chart.set("projection", am5map.geoMercator());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0);
            } else {
            chart.set("projection", am5map.geoOrthographic());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0.1);
            }
        });
        
        cont.children.push(
            am5.Label.new(root, {
            centerY: am5.p50,
            text: "Globe"
            })
        );

        // Make stuff animate on load
        chart.appear(1000, 100);

    }); // end am5.ready()
}


function linechart(elid, data_x, data_y) {
    var data = JSON.parse(document.getElementById(elid + '_data').textContent);
    console.log("Data loaded:", data); // Debug per verificare i dati caricati

    am5.ready(function() {

        var root = am5.Root.new(elid);
        root.setThemes([
            am5themes_Animated.new(root)
        ]);

        var chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panX",
            wheelY: "zoomX",
            pinchZoomX: true
        }));

        var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "none"
        }));
        cursor.lineY.set("visible", false);

        // Utilizza CategoryAxis per l'asse X (per gli anni come categorie)
        var xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: data_x,
            renderer: am5xy.AxisRendererX.new(root, {
                minGridDistance: 30
            })
        }));

        var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        }));

        var series = chart.series.push(am5xy.LineSeries.new(root, {
            name: "Creations",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: data_y,
            categoryXField: data_x,
            tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
            })
        }));

        // Imposta i dati per la serie
        series.data.setAll(data);

        // Effetti di animazione
        series.appear(1000);
        chart.appear(1000, 100);
    }); 
}

function mapDrillDown(elid, data) {

    console.log(elid, data)

    // group data by country
    async function groupDataByCountry(data) {
        let promises = data.map(async (item) => {
            let country = await getCountryByCoords(parseFloat(item.latitude), parseFloat(item.longitude));
            return { country, item };
        });

        // Promise.all to get all data
        let results = await Promise.all(promises);

        // Group data by cities and nations
        let groupedData = {};

        results.forEach(({ country, item }) => {
            if (!groupedData[country]) {
                groupedData[country] = { name: country, count: 0, cities: {} };
            }

            groupedData[country].count++;

            if (!groupedData[country].cities[item.label]) {
                groupedData[country].cities[item.label] = { 
                    name: item.label,
                    count: 0, 
                    geometry: { 
                        type: "Point", 
                        coordinates: [parseFloat(item.longitude), parseFloat(item.latitude)]
                    }
                };
            }
            groupedData[country].cities[item.label].count++;
        });

        return groupedData;
    }

    // initialize map
    am5.ready(function() {
        var root = am5.Root.new(elid);
        root.setThemes([am5themes_Animated.new(root)]);
        var chart = root.container.children.push(
            am5map.MapChart.new(root, {
                panX: "rotateX",
                panY: "translateY",
                projection: am5map.geoMercator()
            })
        );

        // set background 
        var backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
        backgroundSeries.mapPolygons.template.setAll({
            fill: root.interfaceColors.get("alternativeBackground"),
            fillOpacity: 0,
            strokeOpacity: 0
        });
        backgroundSeries.data.push({
            geometry: am5map.getGeoRectangle(90, 180, -90, -180)
        });

        // initialize series
        var citySeries;
        var countrySeries;

        // zoom out button
        var zoomOutButton = root.tooltipContainer.children.push(am5.Button.new(root, {
            x: am5.p100,
            y: 0,
            centerX: am5.p100,
            centerY: 0,
            paddingTop: 18,
            paddingBottom: 18,
            paddingLeft: 12,
            paddingRight: 12,
            dx: -20,
            dy: 20,
            themeTags: ["zoom"],
            icon: am5.Graphics.new(root, {
                themeTags: ["button", "icon"],
                strokeOpacity: 0.7,
                draw: function(display) {
                    display.moveTo(0, 0);
                    display.lineTo(12, 0);
                }
            })
        }));
        zoomOutButton.get("background").setAll({
            cornerRadiusBL: 40,
            cornerRadiusBR: 40,
            cornerRadiusTL: 40,
            cornerRadiusTR: 40
        });
        zoomOutButton.events.on("click", function() {
            chart.goHome();
            zoomOutButton.hide();
            if (citySeries) citySeries.dispose();
            countrySeries.show();
        });
        zoomOutButton.hide();


        // set countries
        var polygonSeries = chart.series.push(
            am5map.MapPolygonSeries.new(root, {
                geoJSON: am5geodata_worldLow,
                exclude: ["AQ"]
            })
        );
        polygonSeries.mapPolygons.template.setAll({
            tooltipText: "{name}",
            interactive: true
        });
        polygonSeries.mapPolygons.template.states.create("hover", {
            fill: am5.color(0xdadada)
        });
        groupDataByCountry(data).then(groupedData => {
            
            // visualization by countries
            countrySeries = chart.series.push(
                am5map.MapPointSeries.new(root, {
                    valueField: "count",
                    calculateAggregates: true
                })
            );

            // set countries bullets
            var circleTemplate = am5.Template.new(root);
            countrySeries.bullets.push(function() {
                var container = am5.Container.new(root, {});
                var circle = container.children.push(am5.Circle.new(root, {
                    radius: 10,
                    fill: am5.color(0x000000),
                    fillOpacity: 0.7,
                    cursorOverStyle: "pointer",
                    tooltipText: "{name}: {count} values"
                }, circleTemplate));

                var label = container.children.push(am5.Label.new(root, {
                    text: "{count}", 
                    fill: am5.color(0xffffff),
                    centerX: am5.p50,
                    centerY: am5.p50,
                    fontSize: 12,
                    populateText: true,
                    textAlign: "center"
                }));

                circle.events.on("click", function(ev) {
                    var countryData = ev.target.dataItem.dataContext;
                    countrySeries.hide();
                    if (citySeries) {
                        citySeries.dispose(); // Remove existing city series
                    }

                    // create new city series
                    citySeries = chart.series.push(
                        am5map.MapPointSeries.new(root, {
                            valueField: "count",
                            calculateAggregates: true
                        })
                    );

                    // set cities bulltets
                    citySeries.bullets.push(function() {
                        var container = am5.Container.new(root, {});

                        var circle = container.children.push(am5.Circle.new(root, {
                            radius: 10,
                            fill: am5.color(0x000000),
                            fillOpacity: 0.7,
                            tooltipText: "{name}: {count} values",
                            cursorOverStyle: "pointer"
                        }));
                        
                        var label = container.children.push(am5.Label.new(root, {
                            text: "{count}", 
                            fill: am5.color(0xffffff),
                            centerX: am5.p50,
                            centerY: am5.p50,
                            fontSize: 12,
                            populateText: true,
                            textAlign: "center"
                        }));

                        return am5.Bullet.new(root, { sprite: container });
                    });
                    citySeries.data.setAll(countryData.cities);
                    chart.zoomToGeoPoint({ latitude: countryData.geometry.coordinates[1], longitude: countryData.geometry.coordinates[0] }, 10);
                    zoomOutButton.show();
                });

                return am5.Bullet.new(root, { sprite: container });
            });

            countrySeries.set("heatRules", [{
                target: circleTemplate,
                dataField: "value",
                min: 10,
                max: 30,
                key: "radius"
            }])

            

            // Carica i dati delle nazioni nella serie
            var countryMarkerData = Object.keys(groupedData).map(country => {
                var countryCities = Object.values(groupedData[country].cities);
                var countryLon = countryCities[0].geometry.coordinates[0];
                var countryLat = countryCities[0].geometry.coordinates[1];

                return {
                    name: country,
                    count: groupedData[country].count,
                    geometry: { type: "Point", coordinates: [countryLon, countryLat] },
                    cities: countryCities
                };
            });
            countrySeries.data.setAll(countryMarkerData);


        });

        // Add globe/map switch
        var cont = chart.children.push(am5.Container.new(root, {
            layout: root.horizontalLayout,
            x: 20,
            y: 40
        }));
        
        cont.children.push(am5.Label.new(root, {
            centerY: am5.p50,
            text: "Map"
        }));
        
        var switchButton = cont.children.push(
            am5.Button.new(root, {
            themeTags: ["switch"],
            centerY: am5.p50,
            icon: am5.Circle.new(root, {
                themeTags: ["icon"]
            })
            })
        );
        
        switchButton.on("active", function () {
            if (!switchButton.get("active")) {
            chart.set("projection", am5map.geoMercator());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0);
            } else {
            chart.set("projection", am5map.geoOrthographic());
            backgroundSeries.mapPolygons.template.set("fillOpacity", 0.1);
            }
        });
        
        cont.children.push(
            am5.Label.new(root, {
            centerY: am5.p50,
            text: "Globe"
            })
        );

        // Make stuff animate on load
        chart.appear(1000, 100);
    });
}


///////////////////////
/// EXTRA FUNCTIONS ///
///////////////////////

// get country name by coords
function getCountryByCoords(lat, lon) {
    const url = `http://api.geonames.org/countryCodeJSON?lat=${lat}&lng=${lon}&username=palread`;

    return new Promise((resolve, reject) => {
        $.getJSON(url, function(data) {
            if (data && data.countryName) {
                resolve(data.countryName);
            } else {
                reject("Country not found");
            }
        }).fail(function(jqXHR, textStatus, errorThrown) {
            reject("Error: " + errorThrown);
        });
    });
}

function getYASQEQuery(item) {
    let query = "";
    let newLine = "";

    var yasqeQueryRows = $(item).find('.CodeMirror-code>div');
    yasqeQueryRows.each(function() {
        var tokens = $(this).find('pre span span');
        query+=newLine;
        tokens.each(function() {
            query += $(this).hasClass('cm-ws') ? ' ' : $(this).text();
            newLine="\n";
        });
    });

    return query
}