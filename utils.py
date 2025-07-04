import os
import re
import time
import datetime
import json
from dotenv import load_dotenv
import web
import requests
import conf
import queries
from collections import defaultdict,OrderedDict
from importlib import reload
from json.decoder import JSONDecodeError
import urllib.parse
import copy

RESOURCE_TEMPLATES = 'resource_templates/'
TEMPLATE_LIST = RESOURCE_TEMPLATES+"template_list.json"
ASK_CLASS = RESOURCE_TEMPLATES+"ask_class.json"
SKOS_VOCAB = conf.skos_vocabularies 

# WEBPY STUFF

def reload_config():
	"""Reload the config from conf.py and overrides the blazegraph endpoint
	   if the env variable is specified.
	"""
	load_dotenv()
	reload(conf)
	myEndpoint = os.getenv('BLAZEGRAPH_ENDPOINT', conf.myEndpoint)
	myPublicEndpoint = os.getenv('PUBLIC_BLAZEGRAPH_ENDPOINT', conf.myPublicEndpoint)

	conf.myEndpoint = myEndpoint
	conf.myPublicEndpoint = myPublicEndpoint


def initialize_session(app):
	""" initialize user session.
	Sessions are pickled in folder /sessions"""
	if web.config.get('_session') is None:
		store = web.session.DiskStore('sessions')
		session = web.session.Session(app, store, initializer={'logged_in': 'False', 'username': 'anonymous', 'gituser': 'None', 'bearer_token': 'None', 'ip_address': 'None', 'records': ''})
		web.config._session = session
		session_data = session._initializer
	else:
		session = web.config._session
		session_data = session._initializer

	web.config.session_parameters['timeout'] = 86400
	return store, session, session_data


def log_output(action, logged_in, user, recordID=None):
	""" log information in console """
	message = '*** '+str(datetime.datetime.now())+' | '+action
	if recordID:
		message += ': <'+recordID+'>'
	message += ' | LOGGED IN: '+str(logged_in)+' | USER: '+user
	print(message)

# LIMIT REQUESTS BY IP ADDRESSES

def write_ip(timestamp, ip_add, request):
	""" write IP addresses in a log file"""
	logs = open(conf.log_file, 'a+')
	logs.write( str(timestamp)+' --- '+ ip_add + ' --- '+ request+'\n')
	logs.close()

def check_ip(ip_add, current_time):
	"""read log file with IP addresses
	limit user POST requests to XX a day"""

	is_user_blocked = False
	limit = int(conf.limit_requests)
	today = current_time.split()[0]
	data = open(conf.log_file, 'r').readlines()
	user_requests = [(line.split(' --- ')[0].split()[0], line.split(' --- ')[1]) for line in data if ip_add in line.split(' --- ')[1] and line.split(' --- ')[0].split()[0] == today ]
	if len(user_requests) > limit:
		is_user_blocked = True
	return is_user_blocked, limit


# METHODS FOR TEMPLATING

def get_dropdowns(fields):
	""" retrieve Dropdowns ids to render them properly
	in Modify and Review form"""
	ids_dropdown= [field['id'] for field in fields if field['type'] in ['Dropdown', 'Subclass']]
	return ids_dropdown

def get_subtemplates(fields):
	""" retrieve Subtemplates ids to render them properly
	in Modify and Review form"""
	ids_subtemplates= [field['id'] for field in fields if field['type'] == 'Subtemplate']
	return ids_subtemplates

def get_timestamp():
	""" return timestamp when creating a new record """
	return str(time.time()).replace('.','-')

def upper(s):
	return s.upper()

# METHODS FOR DATA MODEL

def camel_case_split(identifier):
	matches = re.finditer('.+?(?:(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|$)', identifier)
	return " ".join([m.group(0) for m in matches])

def split_uri(term):
	last_term = term.rsplit("/",1)[1]
	last_term = last_term.split("#")[1] if '#' in last_term else last_term
	return camel_case_split(last_term)

def get_LOV_labels(term, term_type=None):
	""" get class/ property labels from the form"""
	term, label = term, split_uri(term)
	lov_api = "https://lov.linkeddata.es/dataset/lov/api/v2/term/search?q="
	t = "&type="+term_type if term_type else ''
	label_en = "http://www.w3.org/2000/01/rdf-schema#label@en"
	req = requests.get(lov_api+term+t)

	if req.status_code == 200:
		res = req.json()
		for result in res["results"]:
			if result["uri"][0] in [term, term.replace("https","http")]:
				label = result["highlight"][label_en][0] \
					if label_en in result["highlight"] \
					else result["highlight"][label_en.replace("@en","")][0]\
					if label_en not in result["highlight"]  \
					and label_en.replace("@en","") in result["highlight"]\
					else split_uri(term)

	return term, label

def get_LOV_namespace(term):
	""" get prefixed name of a property"""
	term, label = term, split_uri(term)
	lov_api = "https://lov.linkeddata.es/dataset/lov/api/v2/term/search?q="
	label_en = "http://www.w3.org/2000/01/rdf-schema#label@en"
	req = requests.get(lov_api+label+"&type=property")

	if req.status_code == 200:
		res = req.json()
		for result in res["results"]:
			if result["uri"][0] in [term, term.replace("https","http")]:
				prefixed_name = result["prefixedName"]
				return prefixed_name[0]
	return term 

# CONFIG STUFF

def get_vars_from_module(module_name):
	""" get all variables from a python module, e.g. conf"""
	module = globals().get(module_name, None)
	book = {}
	if module:
		book = {key: value for key, value in module.__dict__.items() if not (key.startswith('__') or key.startswith('_'))}
	return book

def toid(s):
	s = s.lower()
	s = s.replace(" ", "_")
	return s

def fields_to_json(data, json_file, skos_file):
	""" setup/update the json file with the form template
	as modified via the web page *template* """

	list_dicts = defaultdict(dict)
	#list_ids = sorted([k.split("__")[0] for k in data.keys()])
	template_config = {'hidden': 'True',
					'subclasses': {}}

	for k,v in data.items():
		if k != 'action' and '__template__' not in k:
			# group k,v by number in the k to preserve the order
			# e.g. '4__type__scope': 'Checkbox'
			idx, json_key , field_id = k.split("__")
			list_dicts[int(idx)]["id"] = field_id
			list_dicts[int(idx)][json_key] = v
		elif '__template__' in k:
			if v == 'on':
				template_config['hidden'] = 'False'
			
	list_dicts = dict(list_dicts)
	for n,d in list_dicts.items():
		
		# Previous code:
		#if 'values' in d:
			#values_pairs = d['values'].replace('\r','').strip().split('\n')
			#d["value"] = "URI"
			#d['values'] = { pair.split(",")[0].strip():pair.split(",")[1].strip() for pair in values_pairs } if values_pairs[0] != "" else {}
			
		if d["type"] in ["Subclass", "Dropdown", "Checkbox"]:
			values = [d[value_key] for value_key in d if value_key.startswith("value")]
			d["value"] = "URI"
			d["values"] = { urllib.parse.unquote(pair.split(",")[0]).strip():urllib.parse.unquote(pair.split(",")[1]).strip() for pair in values } if len(values) > 0 else {}

		# set subclasses
		if d["type"] == "Subclass":
			d["restricted"] = []
			template_config["subclasses"] = d["values"]
			template_config["other_subclass"] = "True" if d["showOther"] == "showOther" else "False"
		else:
			d["restricted"] = [urllib.parse.unquote(d[subclass_key]) for subclass_key in d if subclass_key.startswith("subclass")] 
		
		d["disambiguate"] = "True" if 'disambiguate' in d else "False"
		d["browse"] = "True" if 'browse' in d else "False"
		d["mandatory"] = "True" if 'mandatory' in d else "False" # add mandatory fields
		d["hidden"] = "True" if 'hidden' in d else "False" # add hidden fields
		# default if missing
		if d["type"] == "None":
			d["type"] = "Textbox" if "values" not in d else "Dropdown"
		# date value
		if d["type"] == "Date":
			if d["calendar"] == "Day":
				d["value"] = "Date"
			elif d["calendar"] == "Month":
				d["value"] = "gYearMonth"
			else:
				d["value"] = "gYear"
		if d['type'] in ["Skos", "Subtemplate"]:
			d["value"] = "URI"
		# multimedia
		if d['type'] in ["Multimedia", "WebsitePreview"]:
			d['value'] = "URL"
 		# textarea value
		if d["type"] in ["Textarea"]:
			d["value"] = "Literal"
		if d['type'] == 'KnowledgeExtractor':
			d['knowledgeExtractor'] = "True"
			d["value"] = "undefined"
		else:
			if len(d["label"]) == 0:
				d["label"] = "no label"
			if len(d["property"]) == 0:
				d["property"] = "http://example.org/"+d["id"]

		# add default values
		d['searchWikidata'] = "True" if d['type'] == 'Textbox' and d['value'] == 'URI' else "False"
		d['searchGeonames'] = "True" if d['type'] == 'Textbox' and d['value'] == 'Place' else "False"
		d['searchOrcid'] = "True" if d['type'] == 'Textbox' and d['value'] == 'Researcher' else "False"
		d['searchSkos'] = "True" if d['type'] == 'Skos' else "False"
		d['url'] = "True" if d['type'] == 'Textbox' and d['value'] == 'URL' else "False"

		# update SKOS thesauri list and mark selected ones
		vocab_data = update_skos_vocabs(d, SKOS_VOCAB)
		d['skosThesauri'] = vocab_data[0]
		for idx in range(len(vocab_data[1])):
			d['skos'+vocab_data[1][idx]] = d['skosThesauri'][idx] 

		# imported subtemplates
		d["import_subtemplate"] = [RESOURCE_TEMPLATES+field_key+".json" for field_key in d if field_key.startswith("template-")]

		# extra
		d["disabled"] = "False"
		d["class"]= "col-md-12 yearField" if d["type"] == "Date" and d["calendar"] == "Year" else "col-md-12"
		d["cache_autocomplete"] ="off"
		# view classes: mark elements in the final Record visualization
		d["view_class"] = ''
		d["view_class"] += " subtemplateField" if d["type"] == "Subtemplate" else ""
		

		
	# add a default disambiguate if none is selected
	is_any_disambiguate = ["yes" for n,d in list_dicts.items() if d['disambiguate'] == 'True']
	if len(is_any_disambiguate) == 0:
		ids_disamb = [[n, d["disambiguate"]] for n,d in list_dicts.items() if d['type'] == 'Textbox' and d['value'] == 'URI']
		if len(ids_disamb) > 0:
			list_dicts[ids_disamb[0][0]]["disambiguate"] = "True"

	ordict = OrderedDict(sorted(list_dicts.items()))
	ordlist = [d for k,d in ordict.items()]
	# store the dict as json file
	with open(json_file, 'w') as fout:
		fout.write(json.dumps(ordlist, indent=1))

	with open(TEMPLATE_LIST, 'r') as file:
		tpls = json.load(file)

	# Modify the template status in tpl_list
	for tpl in tpls:
		if tpl['template'] == json_file:
			tpl['hidden'] = template_config['hidden']
			tpl['subclasses'] = template_config['subclasses']
			if 'other_subclass' in template_config:
				tpl['other_subclass'] = template_config["other_subclass"]

	with open(TEMPLATE_LIST, 'w') as file:
		json.dump(tpls, file, indent=1)

def validate_setup(data):
	""" Validate user input in setup page and check errors / missing values"""

	data["myEndpoint"] = data["myEndpoint"] if "myEndpoint" in data and data["myEndpoint"].startswith("http") else "http://127.0.0.1:3000/blazegraph/sparql"
	data["myPublicEndpoint"] = data["myPublicEndpoint"] if data["myPublicEndpoint"].startswith("http") else "http://127.0.0.1:8080/bigdata/sparql"
	data["sparqlAnythingEndpoint"] = data["sparqlAnythingEndpoint"] if data["sparqlAnythingEndpoint"].startswith("http") else "http://127.0.0.1:8081/sparql.anything"
	data["base"] = data["base"] if data["base"].startswith("http") else "http://example.org/base/"
	# data["main_entity"] = data["main_entity"] if data["main_entity"].startswith("http") else "http://example.org/entity/"
	data["limit_requests"] = data["limit_requests"] if isinstance(int(data["limit_requests"]), int) else "50"
	data["pagination"] = data["pagination"] if isinstance(int(data["pagination"]), int) else "10"
	data["github_backup"] = data["github_backup"] if data["github_backup"] in ["True", "False"] else "False"
	# github backup
	if data["github_backup"] == "True" \
		and (len(data["repo_name"]) > 1 and len(data["owner"]) > 1 and len(data["author_email"]) > 1 and len(data["token"]) > 1):
		data["github_backup"] = "True"
	else:
		data["github_backup"] = "False"

	return data

def init_js_config(data):
	"""Initializes the JS config by the given data

	Parameters
	----------
	data: dict
		Dictionary that is either the initial config or the given data record.
	"""
	with open('static/js/conf.js', 'w') as jsfile:
		jsfile.writelines('var myPublicEndpoint = "'+data.myPublicEndpoint+'";\n')
		jsfile.writelines('var base = "'+ data.base +'";\n')
		# TODO, support for data served in a single graph
		jsfile.writelines('var graph = "";\n')

def updateTemplateList(res_name=None,res_type=None,res_description=None,remove=False):
	"""Update the list of resource templates.
	If the list has not been created yet, it creates the file.

	Parameters
	----------
	res_name: str
		Name of the class associated to the template. Becomes dictionary key
	res_type: str
		URI of the class associated to the template. Becomes dictionary value
	"""

	# create the template list for the first time
	if not os.path.isfile(TEMPLATE_LIST):
		f = open(TEMPLATE_LIST, "w")

	# add a new template
	if res_name and res_type and remove==False:
		try:
			with open(TEMPLATE_LIST,'r') as tpl_file:
				data = json.load(tpl_file)
		except JSONDecodeError:
			data = []

		res = {}
		res["name"] = res_name
		res["short_name"] = res_name.replace(' ','_').lower()
		res["type"] = res_type
		res["description"] = res_description
		res["template"] = RESOURCE_TEMPLATES+'template-'+res_name.replace(' ','_').lower()+'.json'
		res["hidden"] = "False"
		res["subclasses"] = {}
		res["other_subclass"] = "False"
		data.append(res)

		with open(TEMPLATE_LIST,'w') as tpl_file:
			json.dump(data, tpl_file)

	# remove a template
	if res_name and remove==True:
		with open(TEMPLATE_LIST,'r') as tpl_file:
			data = json.load(tpl_file)

		for i in range(len(data)):
			if data[i]['short_name'] == res_name:
				to_be_deleted = data[i]['template']
				if os.path.exists(to_be_deleted):
					os.remove(to_be_deleted)
				del data[i]
				break
		with open(TEMPLATE_LIST,'w') as tpl_file:
			json.dump(data, tpl_file)

def get_template_from_class(res_type):
	print("###res_type",res_type)
	""" Return the template file path and a list of subclasses given the URI of the OWL class

	Parameters
	----------
	res_type: list
		URI of the class associated to the template. Becomes dictionary value
	"""
	res_subclasses = []

	with open(TEMPLATE_LIST,'r') as tpl_file:
		data = json.load(tpl_file)

	for t in data:
		for s in t["subclasses"]:
			if s in res_type:
				res_subclasses.append(s) 
				res_type.remove(s)
	res_template = next((t["template"] for t in data if t["type"] == sorted(res_type)), None)
	return res_template, res_subclasses

def get_class_from_template(res_tpl):
	print("###res_template",res_tpl)
	""" Return the URI of the OWL class given the template path

	Parameters
	----------
	res_tpl: str
		Path associated to the template. Becomes dictionary value
	"""

	with open(TEMPLATE_LIST,'r') as tpl_file:
		data = json.load(tpl_file)

	res_type = [t["type"] for t in data if t["template"] == res_tpl][0]
	return res_type

def update_ask_class(template_path,res_name,remove=False):
	""" Update the list of existing templates in ask_class.json.
	The form is shown when creating a new record and let the user
	decide the template.

	Parameters
	----------
	res_name: str
		Name of the class associated to the template. Becomes dictionary key
	template_path: str
		The local path of the template form (json file)

	"""
	print(template_path,res_name)
	with open(ASK_CLASS,'r') as tpl_file:
		ask_tpl = json.load(tpl_file)

	if remove:
		ask_tpl[0]["values"].pop(template_path,None)
	else:
		ask_tpl[0]["values"][template_path] = res_name

	# get list of templates
	# with open(TEMPLATE_LIST,'r') as tpl_file:
	# 	tpl_list = json.load(tpl_file)
	#tpl_names = [t["short_name"] for t in tpl_list]
	#tpl_names = [t["name"] for t in tpl_list]

	# check if any template has been removed manually
	# in case, remove it from the ask template
	# for tpl_file,tpl_name in ask_tpl[0]['values'].items():
	# 	if tpl_name not in tpl_names:
	# 		ask_tpl[0]["values"].pop(tpl_file,None)

	with open(ASK_CLASS,'w') as tpl_file:
		json.dump(ask_tpl, tpl_file)

def check_ask_class():
	""" check if any template has been removed manually,
	before loading the new record template.
	In case, remove the template name from the ask template """
	with open(ASK_CLASS,'r') as tpl_file:
		ask_tpl = json.load(tpl_file)

	with open(TEMPLATE_LIST,'r') as tpl_file:
		tpl_list = json.load(tpl_file)
	tpl_names = [t["short_name"] for t in tpl_list]
	print("tpl_names",tpl_names)
	remove_tpls = []
	for tpl_file,tpl_name in ask_tpl[0]['values'].items():
		print("tpl_file,tpl_name",tpl_file,tpl_name)
		if tpl_name not in tpl_names:
			remove_tpls.append(tpl_file)
	print("remove_tpls",remove_tpls)
	for tpl_file in remove_tpls:
		ask_tpl[0]["values"].pop(tpl_file,None)

	with open(ASK_CLASS,'w') as tpl_file:
		json.dump(ask_tpl, tpl_file)

def change_template_names(is_git_auth=True):
	""" open the ASK FORM and change the template short_names with full name
	to be shown when creating a new record """
	with open(ASK_CLASS,'r') as tpl_file:
		ask_tpl = json.load(tpl_file)

	with open(TEMPLATE_LIST,'r') as tpl_file:
		tpl_list = json.load(tpl_file)

	if is_git_auth:
		for tpl_file,tpl_name in ask_tpl[0]['values'].items():
			full_name = [tpl["name"] for tpl in tpl_list if tpl["short_name"] == tpl_name][0]
			ask_tpl[0]['values'][tpl_file] = full_name
	else:
		ask_tpl_copy = copy.deepcopy(ask_tpl)
		for tpl_file,tpl_name in ask_tpl_copy[0]['values'].items():
			full_name_list = [tpl["name"] for tpl in tpl_list if tpl["short_name"] == tpl_name and tpl["hidden"] == "False"]
			if len(full_name_list) > 0:
				ask_tpl[0]['values'][tpl_file] = full_name_list[0]
			else:
				del ask_tpl[0]['values'][tpl_file]
	return ask_tpl

def get_templates_description():
	""" Return a list of descriptions of available templates """
	with open(TEMPLATE_LIST,'r') as tpl_file:
		data = json.load(tpl_file)

	descriptions_dict = {tpl["template"]: {"description": tpl.get("description", ""), "name": tpl.get("name", "")} for tpl in data}
	return descriptions_dict

# UTILS

def key(s):
	"""Return a datetime from a timestamp

	Parameters
	----------
	s: str
		A string representing a timestamp
	"""
	fmt = "%Y-%m-%dT%H:%M:%S"
	cleandate = datetime.datetime.strptime(s, fmt) if s else '-'
	return cleandate

def isnum(s):
	return s.isnumeric()


# UPDATE THE LIST OF AVAILABLE SKOS VOCABS
def update_skos_vocabs(d, skos):
	if not os.path.isfile(skos):
			skos_file = None
	else:
		with open(skos, 'r') as skos_list:
			skos_file = json.load(skos_list)
	
	selected_vocabs = []
	number_list = []
	for key in list(d.keys()):
		if key.startswith("skos") and key != "vocables":
			number = int(re.search(r'\d+', key).group())
			if number > len(skos_file):
				number_list.append(str(number))
				label, url, query, endpoint = d[key].split("__")
				query = urllib.parse.unquote(query)
				query = "} }".join(query.rsplit("}", 1))
				skos_file[label] = {
					"type": "SPARQL",
					"url": url,
					"endpoint": endpoint,
					"query": query.replace("\n", "").replace("\r", "").replace("{", "{ SERVICE <"+url+"> {", 1),
					"results": {
						"array": "results.bindings", 
						"label": "label.value", 
						"uri": "uri.value"
					}
				}
				selected_vocabs.append(label)
				with open(skos, 'w') as file:
					json.dump(skos_file, file)
			else:
				selected_vocabs.append(d[key])
	return [selected_vocabs, number_list]


# KNOWLEDGE EXTRACTION
def has_extractor(res_template, record_name=None, processed_templates=[], res_subclasses=[]):
	"""Return a list of Knowledge Extraction input fields (if record_name == None) 
	or a list of named graphs that may contain extractions (if record_name != None)

	Parameters
	----------
	res_template: str
		a string representing the id of a Template
	record_name: str / None
		a string representing the id of a Named Graph
	"""

	if record_name != None:

		#check whether a Record and its sub-Records are associated with any Extraction graph
		result = []
		graph_uri = conf.base+record_name+'/'

		with open(res_template,'r') as tpl_file:
			data = json.load(tpl_file)

		for field in data:

			#check whether the Graph may contain any Extraction
			if 'knowledgeExtractor' in field and field['knowledgeExtractor'] == 'True':
				if res_subclasses != []:
					if field['restricted'] == [] or any(res_subclass in field['restricted'] for res_subclass in res_subclasses):
						result.append((graph_uri, field['property'], field['label'], field['id']))
				else:
					result.append((graph_uri, field['property'], field['label'], field['id']))

			#check whether the Graph may contain any sub-Record
			if 'import_subtemplate' in field and field['import_subtemplate'] != []:
				subrecords = queries.get_subrecords(field['property'],record_name)
				for subrecord in subrecords:
					for imported_template in field['import_subtemplate']:
						result.extend(has_extractor(imported_template,subrecord.rsplit('/',1)[1]))
					
		return result
	else:

		# checks whether a template allows some knowledge extraction
		processed_templates.append(res_template)
		result = []
		with open(res_template,'r') as tpl_file:
			data = json.load(tpl_file)

		if data:
			for field in data:
				if 'knowledgeExtractor' in field and field['knowledgeExtractor'] == 'True':
					label = field['label'] if 'label' in field else ""
					pre = field['prepend'] if 'prepend' in field else ""
					field_id = field['id'] if 'id' in field else ""
					service = field['service'] if 'service' in field else ""
					subclass_restriction = "; ".join(field['restricted']) if 'restricted' in field else ""

					# store the extractor details as a tuple
					result.append((res_template, label, pre, field_id, service, subclass_restriction))

				elif 'import_subtemplate' in field and field['import_subtemplate'] != []:
					# iterate over sub-templates
					for imported_template in field['import_subtemplate']:
						if imported_template not in processed_templates:
							result.extend(has_extractor(imported_template, record_name=None,processed_templates=processed_templates))

		return result

def check_mandatory_fields(recordData):
	tpl_ID = recordData.templateID
	with open(tpl_ID,'r') as tpl_file:
		tpl_fields = json.load(tpl_file)
	for field in tpl_fields:
		if 'mandatory' in field and field['mandatory'] == 'True':
			if recordData[field['id']] == '' and not any(key.startswith(field['id']) and recordData[key] != '' for key in recordData):
				return False
	return True	

def get_query_templates(res_tpl):
	# initialize a blank dict
	query_dict = {}

	# get SKOS Thesauri
	if not os.path.isfile(SKOS_VOCAB):
		skos_file = None
	else:
		with open(SKOS_VOCAB, 'r') as skos_list:
			skos_file = json.load(skos_list)

	# get the template fields	
	with open(res_tpl,'r') as tpl_file:
		tpl_fields = json.load(tpl_file)
	for field in tpl_fields:
		# get SKOS thesauri settings for 'Vocab' type fields
		if 'type' in field and field['type'] == 'Skos':
			field_id = field['id']
			field_thesauri = field['skosThesauri']
			query_dict[field_id] = []
			for thesaurus in field_thesauri:
				if thesaurus in skos_file:
					included_thesauri = query_dict[field_id]
					included_thesauri.append({ thesaurus: skos_file[thesaurus] })
					query_dict[field_id] = included_thesauri
		# get SPARQL constraints for 'Textbox (Entity)' type fields
		if 'searchWikidata' in field and field['searchWikidata'] == 'True':
			field_id = field['id']
			if 'wikidataConstraint' in field and 'catalogueConstraint' in field:
				query_dict[field_id] = {'wikidata':field['wikidataConstraint'].replace('\r','').replace('\n',''), 'catalogue':field['catalogueConstraint'].replace('\r','').replace('\n','')}
			elif 'wikidataConstraint' in field:
				query_dict[field_id] = field['wikidataConstraint'].replace('\r','').replace('\n','')
			elif 'catalogueConstraint' in field:
				query_dict[field_id] = field['catalogueConstraint'].replace('\r','').replace('\n','')
	return query_dict


# CHARTS CONFIG
def charts_to_json(charts_file, data, update_json=True):

	# initialize a blank list of dictionaries
	charts = {"charts": []}

	# parse data
	list_dicts = defaultdict(dict)
	for k,v in data.items():
		if k != 'action':
			# group k,v by number in the k to preserve the order
			# e.g. '4__type__scope': 'Checkbox'
			idx, json_key, field_id = k.split("__")
			list_dicts[int(idx)]["id"] = idx
			list_dicts[int(idx)][json_key] = v
	
	for idx,params in list_dicts.items():
		# counters
		counters = [{
			"id": str(idx)+"__"+viz+"__"+str(idx),
			"query": params[viz],
			"title": " ".join(viz.split("_")[1:])
		} for viz in params if viz.startswith("counter")]
		counters = sorted(counters, key=lambda x: x["id"])
		params["counters"] = counters

		# sorted
		if "y-sort" in params:
			params["sorted"] = "y"
		elif "x-sort" in params:
			params["sorted"] = "x"

		#legend
		params["legend"] = "True" if "legend" in params else "False"		

	# sort viz by index
	ordict = OrderedDict(sorted(list_dicts.items()))
	ordlist = [d for k,d in ordict.items()]
	charts["charts"] = ordlist

	# save json
	if update_json:
		with open(charts_file, 'w') as fout:
			fout.write(json.dumps(charts, indent=4))
	else:
		return charts 

def delete_charts(charts_file):
	with open(charts_file, 'w') as fout:
		fout.write(json.dumps({}, indent=4))
	