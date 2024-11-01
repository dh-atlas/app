import requests
import sys

def carica_grafo_rdf(file_path, blazegraph_url='http://127.0.0.1:3000/blazegraph/sparql', formato='text/turtle'):
    """
    :param file_path: Percorso al file RDF da caricare.
    :param blazegraph_url: URL dell'endpoint Blazegraph per il caricamento dei dati.
    :param formato: Formato del file RDF (es. 'text/turtle', 'application/rdf+xml').
    """
    with open(file_path, 'rb') as file:
        dati = file.read()
    
    headers = {
        'Content-Type': formato
    }

    response = requests.post(blazegraph_url, data=dati, headers=headers)

    if response.status_code in [200, 201, 204]:
        print("Grafo RDF caricato con successo in Blazegraph.")
    else:
        print(f"Errore nel caricamento del grafo RDF. Codice di stato: {response.status_code}")
        print("Risposta del server:", response.text)



carica_grafo_rdf("C:/Users/sebas/Desktop/ATLAS/records/1728928554-0924258.ttl")
