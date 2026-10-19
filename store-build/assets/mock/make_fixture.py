"""Doua organizatii FICTIVE pentru pagina demo (teste + capturi pentru Store). Nimic real: nume, proiecte, agenti
inventati. Cuvintele interfetei = dictionarul platformei (labels.json, acelasi ca HUD_DEFAULT_LABELS de pe server).

Rulare:  python make_fixture.py <labels.json>   → fixture.js langa acest fisier
"""
import io
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
labels = json.load(io.open(sys.argv[1], encoding='utf-8'))
LINKS = [['Chat', '/'], ['Imagini', '/images'], ['Aplicații', '/apps'], ['GPT-uri', '/gpts'], ['Plugins', '/plugins'], ['Library', '/library']]

atelier = {
    'version': 1760000000000,
    'org': {'id': 'atelier_demo', 'name': 'Atelier Demo'},
    'orgs': [{'id': 'atelier_demo', 'name': 'Atelier Demo'}, {'id': 'beta_construct', 'name': 'Beta Construct'}],
    'labels': labels,
    'links': LINKS,
    'branding': {'title': 'HUD ATELIER', 'system': 'RENDA', 'subtitle': 'banda de lucru a echipei', 'command_title': 'ATELIER DEMO', 'command_subtitle': 'Proiectăm împreună, cu AI'},
    'templates': [
        ['Plan de lucru pe azi', 'Fă-mi un plan pe ore pentru azi, pornind de la sarcinile de mai jos:\n', 'Organizare'],
        ['Rezumat executiv', 'Rezumă textul de mai jos în 5 puncte, pentru un client:\n', 'Organizare'],
        ['Verificare adversarială', 'Caută greșelile din răspunsul tău anterior și corectează-le.', 'Calitate'],
        ['Răspuns simplu', 'Răspunde scurt, în limbaj obișnuit.', 'Calitate'],
    ],
    'texts': {'boot_footer': 'Lucrează în acord cu regulile Atelierului.', 'day_text': 'Bună, sunt {name}. Ajută-mă să-mi organizez ziua.', 'shkn_owner': 'Atelier Demo'},
    'synonyms': [{'label': 'urbanism', 'terms': ['urbanism', 'pug', 'puz']}, {'label': 'juridic', 'terms': ['juridic', 'avocat', 'lege']}, {'label': None, 'terms': ['pdf', 'document']}],
    'shkn_contact': 'Ana Ionescu',
    'features': {'skill_lockdown': False},
    'agents': {
        'agents': [
            {'n': 'Asistent Urbanism', 'c': 'URBANISM', 'e': 'Analizează PUG/PUZ și avize, cu surse oficiale.', 'u': 'g-demo-urbanism'},
            {'n': 'Asistent Juridic', 'c': 'JURIDIC', 'e': 'Analiză contractuală prudentă, cu trimiteri la lege.', 'u': 'g-demo-juridic'},
            {'n': 'Asistent Devize', 'c': 'FINANCIAR', 'e': 'Construiește și verifică devize generale.', 'u': 'g-demo-devize'},
        ],
        'external': [{'n': 'Consultant Extern', 'c': 'GENERAL', 'e': 'Expert extern pentru întrebări generale.', 'u': 'g-demo-extern', 'a': 'consultant'}],
        'skills': [],
    },
    'plugins': [
        {'n': 'Raport de proiect', 'id': 'Plugin_demo1', 'd': 'Generează raportul săptămânal al proiectului.', 'k': [['raport-saptamanal', 'Raport săptămânal', '$raport-saptamanal', '']], 'g': ['management']},
        {'n': 'Verificare documentație', 'id': 'Plugin_demo2', 'd': 'Verifică documentația față de cerințe.', 'k': [['verifica-pug', 'Verifică un PUG', '$verifica-pug', ''], ['verifica-aviz', 'Verifică un aviz', '$verifica-aviz', '']], 'g': ['urbanism']},
    ],
    'teze': {'title': 'PRINCIPIILE ATELIERULUI', 'teze': [{'n': 1, 't': 'Clientul înainte de toate', 'p': [{'c': '1.1', 'k': 'Ascultă', 'd': 'Întâi înțelegi cererea.'}]}]},
    'boot_meta': {'models': [{'t': 'EXECUTANT', 'cp': 'Primesc obiectivul și livrez la termen.', 'v': 'Coordonatorul'}], 'steps': ['Copiază boot-ul la începutul conversației.']},
    'shkn': {'items': [
        {'id': '0001', 't': 'Plan de lucru din planșe PDF', 'o': 'Ana Ionescu', 'd': '01.09.2026', 'cz': 'proiect demo', 'tags': ['pdf', 'plan', 'planșe'], 'b': 'Pașii:\n1. Citește planșele.\n2. Extrage cotele.\n3. Verifică.'},
        {'id': '0002', 't': 'Verificarea unui aviz', 'o': 'Mihai Popa', 'd': '15.09.2026', 'cz': 'aviz demo', 'tags': ['aviz', 'urbanism'], 'b': 'Compară avizul cu cererea, punct cu punct.'},
    ]},
    'missions': [{'f': 'Arhitect', 'm': 'Transpun viziunea clientului în proiecte clare.', 'a': ['Livrez la termen', 'Verific coordonarea', 'Documentez deciziile']}],
    'mission_map': [['arhitect', 'Arhitect']],
}

beta = {
    'version': 1760000000001,
    'org': {'id': 'beta_construct', 'name': 'Beta Construct'},
    'orgs': atelier['orgs'],
    'labels': dict(labels, **{'st.h': '📁 ȘANTIERE & ECHIPĂ'}),
    'links': [['Chat', '/'], ['GPT-uri', '/gpts']],
    'branding': {'title': 'BETA HUD', 'system': 'RENDA', 'subtitle': 'construcții', 'command_title': 'BETA CONSTRUCT', 'command_subtitle': 'Șantier digital'},
    'templates': [['Raport de șantier', 'Scrie raportul zilnic de șantier din notițele de mai jos:\n', 'Șantier']],
    'texts': {'day_text': 'Sunt {name}, șef de șantier. Planifică-mi ziua.'},
    'agents': {'agents': [{'n': 'Asistent Șantier', 'c': 'EXECUȚIE', 'e': 'Ajută la rapoarte și planificarea execuției.', 'u': 'g-beta-santier'}], 'external': [], 'skills': []},
    'plugins': [],
}

me = {
    'atelier_demo': {'account': {'email': 'ana.ionescu@exemplu.ro', 'name': 'Ana Ionescu'}, 'role': {'rol_id': 'DEMO-ROL-1', 'functie': 'Arhitect', 'departament': 'Proiectare', 'diviziune': 'Studio', 'tip_rol': 'EXECUTANT', 'coordinator_name': 'Mihai Popa', 'boot_session': '[SESSION — Ana Ionescu | Atelier Demo | Arhitect]', 'statut': 'activ', 'misiune': '', 'actiuni': []}, 'role_model': {'t': 'EXECUTANT', 'cp': 'Primesc obiectivul și livrez la termen.', 'v': 'Coordonatorul'}},
    'beta_construct': {'account': {'email': 'ana.ionescu@exemplu.ro', 'name': 'Ana Ionescu'}, 'role': None, 'role_model': None},
}
directory = {
    'atelier_demo': {'projects': [
        {'id': 'p1', 'short_code': 'DT-01', 'label': 'Demo Tower — clădire de birouri', 'type': 'PRODUCTIE', 'status': 'ACTIVE'},
        {'id': 'p2', 'short_code': 'PV-02', 'label': 'Parc Verde — ansamblu rezidențial', 'type': 'PRODUCTIE', 'status': 'ACTIVE'},
        {'id': 'p3', 'short_code': 'SC-03', 'label': 'Școala Nouă — reabilitare', 'type': 'SUPORT', 'status': 'PENDING'}],
        'employees': [{'uuid': 'u1', 'name': 'Ana Ionescu', 'email': 'ana.ionescu@exemplu.ro', 'phone': ''}, {'uuid': 'u2', 'name': 'Mihai Popa', 'email': 'mihai.popa@exemplu.ro', 'phone': ''}]},
    'beta_construct': {'projects': [{'id': 'b1', 'short_code': 'SANT-7', 'label': 'Șantier Pod Nord', 'type': 'EXECUTIE', 'status': 'ACTIVE'}], 'employees': [{'uuid': 'u1', 'name': 'Ana Ionescu', 'email': 'ana.ionescu@exemplu.ro', 'phone': ''}]},
}

out = 'window.RV_FIXTURE = ' + json.dumps({'config': {'atelier_demo': atelier, 'beta_construct': beta}, 'me': me, 'directory': directory}, ensure_ascii=False) + ';\n'
io.open(HERE / 'fixture.js', 'w', encoding='utf-8').write(out)
print('fixture.js: 2 organizatii fictive')
