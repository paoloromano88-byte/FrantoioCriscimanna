import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDZVN1cERAIIiB7igO25b9Mrk_rpQi2qmg",
    authDomain: "frantoiocriscimanna-9e4df.firebaseapp.com",
    projectId: "frantoiocriscimanna-9e4df",
    storageBucket: "frantoiocriscimanna-9e4df.firebasestorage.app",
    messagingSenderId: "2790162303",
    appId: "1:2790162303:web:d20f046315e04a7fbaa44a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementi UI Anagrafica
const anagNome = document.getElementById('anag-nome');
const anagTelefono = document.getElementById('anag-telefono');
const anagNote = document.getElementById('anag-note');
const btnSalvaAnagrafica = document.getElementById('btn-salva-anagrafica');
const inputCercaAnagrafica = document.getElementById('input-cerca-anagrafica');
const contenitoreListaClienti = document.getElementById('contenitore-lista-clienti');

// Elementi UI Deposito
const inputCliente = document.getElementById('input-cliente');
const listaClienti = document.getElementById('lista-clienti');
const inputCassa = document.getElementById('input-cassa');
const btnConferma = document.getElementById('btn-conferma');
const btnAttivaScan = document.getElementById('btn-attiva-scan');

// Elementi UI Riepilogo
const contenitoreRiepilogo = document.getElementById('contenitore-riepilogo');
const btnAggiornaRiepilogo = document.getElementById('btn-aggiorna-riepilogo');

// Elementi UI Molitura
const inputMolituraCliente = document.getElementById('input-molitura-cliente');
const listaPartiteAperte = document.getElementById('lista-partite-aperte');
const inputPeso = document.getElementById('input-peso');
const btnChiudiMolitura = document.getElementById('btn-chiudi-molitura');

let html5QrcodeScanner;
let mappaClienti = {};
let mappaPartiteAperte = {};
let listaClientiCache = []; // Cache per ricerca anagrafica


// ==========================================
// 1. ANAGRAFICA E CARICAMENTO CLIENTE
// ==========================================
async function caricaClienti() {
    try {
        const querySnapshot = await getDocs(collection(db, "clienti"));
        listaClienti.innerHTML = '';
        mappaClienti = {};
        listaClientiCache = [];

        querySnapshot.forEach((docSnap) => {
            const dati = docSnap.data();
            const nome = dati.nome;
            const id = docSnap.id;
            const telefono = dati.telefono || "N/D";
            const note = dati.note || "";

            mappaClienti[nome.toLowerCase().trim()] = id;
            listaClientiCache.push({ id, nome, telefono, note });

            // Popola il datalist per il deposito
            const option = document.createElement("option");
            option.value = nome;
            listaClienti.appendChild(option);
        });

        mostraListaAnagrafica(listaClientiCache);

    } catch (error) {
        console.error("Errore caricamento clienti:", error);
    }
}

function mostraListaAnagrafica(clienti) {
    if (clienti.length === 0) {
        contenitoreListaClienti.innerHTML = '<p style="color: #666; text-align: center;">Nessun cliente in anagrafica.</p>';
        return;
    }

    let html = '';
    clienti.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
        html += `
            <div class="riga-anagrafica">
                <strong>${c.nome}</strong><br>
                📞 Tel: ${c.telefono} ${c.note ? ' | 📝 ' + c.note : ''}
            </div>
        `;
    });
    contenitoreListaClienti.innerHTML = html;
}

// Ricerca in tempo reale dentro l'anagrafica
if (inputCercaAnagrafica) {
    inputCercaAnagrafica.addEventListener('input', (e) => {
        const filtro = e.target.value.toLowerCase().trim();
        const filtrati = listaClientiCache.filter(c => 
            c.nome.toLowerCase().includes(filtro) || c.telefono.includes(filtro)
        );
        mostraListaAnagrafica(filtrati);
    });
}

// Pulsante salvataggio nuovo cliente direttamente dall'anagrafica
if (btnSalvaAnagrafica) {
    btnSalvaAnagrafica.addEventListener('click', async () => {
        const nome = anagNome.value.trim();
        const telefono = anagTelefono.value.trim();
        const note = anagNote.value.trim();

        if (!nome) { alert("Inserisci almeno il nome del cliente!"); return; }

        try {
            const nuovoClienteRef = doc(collection(db, "clienti"));
            await setDoc(nuovoClienteRef, { nome, telefono, note });

            alert(`Cliente "${nome}" salvato in anagrafica con successo!`);
            anagNome.value = '';
            anagTelefono.value = '';
            anagNote.value = '';

            caricaClienti();
        } catch (error) {
            console.error("Errore salvataggio cliente:", error);
            alert("Errore durante il salvataggio.");
        }
    });
}


async function caricaPartiteAperte() {
    try {
        const q = query(collection(db, "partite"), where("stato", "==", "aperta"));
        const querySnapshot = await getDocs(q);
        
        listaPartiteAperte.innerHTML = '';
        mappaPartiteAperte = {};

        for (const docSnap of querySnapshot.docs) {
            const dati = docSnap.data();
            let nomeCliente = dati.id_cliente; 
            const clienteRef = await getDoc(doc(db, "clienti", dati.id_cliente));
            if(clienteRef.exists()) { nomeCliente = clienteRef.data().nome; }

            mappaPartiteAperte[nomeCliente.toLowerCase().trim()] = docSnap.id;

            const option = document.createElement("option");
            option.value = nomeCliente;
            listaPartiteAperte.appendChild(option);
        }

    } catch (error) {
        console.error("Errore caricamento partite:", error);
    }
}

async function aggiornaRiepilogo() {
    contenitoreRiepilogo.innerHTML = '<p style="color: #666; text-align: center;">Aggiornamento in corso...</p>';
    try {
        const qPartite = query(collection(db, "partite"), where("stato", "==", "aperta"));
        const partiteSnap = await getDocs(qPartite);

        if (partiteSnap.empty) {
            contenitoreRiepilogo.innerHTML = '<p style="color: #666; text-align: center;">Nessuna cassa in attesa nel piazzale.</p>';
            return;
        }

        let htmlRiepilogo = '';

        for (const partitaDoc of partiteSnap.docs) {
            const datiPartita = partitaDoc.data();
            let nomeCliente = datiPartita.id_cliente;
            let telCliente = "";
            
            const clienteSnap = await getDoc(doc(db, "clienti", datiPartita.id_cliente));
            if (clienteSnap.exists()) { 
                nomeCliente = clienteSnap.data().nome;
                telCliente = clienteSnap.data().telefono ? ` (Tel: ${clienteSnap.data().telefono})` : "";
            }

            const qCasse = query(collection(db, "casse"), where("id_partita_attuale", "==", partitaDoc.id));
            const casseSnap = await getDocs(qCasse);
            
            let codiciCasse = [];
            casseSnap.forEach(c => codiciCasse.push(c.id));

            if (codiciCasse.length > 0) {
                htmlRiepilogo += `
                    <div class="riga-cliente">
                        <strong>${nomeCliente}</strong> ${telCliente}
                        <span class="badge-casse">${codiciCasse.length} casse</span>
                        <span class="dettaglio-casse">Codici: ${codiciCasse.join(', ')}</span>
                    </div>
                `;
            }
        }
        
        contenitoreRiepilogo.innerHTML = htmlRiepilogo !== '' ? htmlRiepilogo : '<p style="color: #666; text-align: center;">Nessuna cassa in attesa nel piazzale.</p>';

    } catch (error) {
        console.error("Errore riepilogo:", error);
        contenitoreRiepilogo.innerHTML = '<p style="color: red;">Errore nel caricamento del riepilogo.</p>';
    }
}
if (btnAggiornaRiepilogo) {
    btnAggiornaRiepilogo.addEventListener('click', aggiornaRiepilogo);
}


// ==========================================
// 2. SCANNER FOTOCAMERA
// ==========================================
if (btnAttivaScan) {
    btnAttivaScan.addEventListener('click', () => {
        document.getElementById('reader').style.display = 'block';
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        html5QrcodeScanner.render((testoDecodificato) => {
            inputCassa.value = testoDecodificato;
            html5QrcodeScanner.clear();
            document.getElementById('reader').style.display = 'none';
        }, () => {});
    });
}


// ==========================================
// 3. REGISTRAZIONE DEPOSITO + STAMPA RICEVUTA
// ==========================================
if (btnConferma) {
    btnConferma.addEventListener('click', async () => {
        const nomeDigitato = inputCliente.value.trim();
        const idCassa = inputCassa.value.trim().toUpperCase();

        if (!nomeDigitato) { alert("Inserisci il nome del cliente!"); return; }
        if (!idCassa) { alert("Devi inserire o scansionare una cassa!"); return; }

        btnConferma.disabled = true;
        btnConferma.innerText = "Registrazione...";

        try {
            const batch = writeBatch(db);
            let idCliente = "";

            const chiaveNome = nomeDigitato.toLowerCase();
            if (mappaClienti[chiaveNome]) {
                idCliente = mappaClienti[chiaveNome];
            } else {
                const nuovoClienteRef = doc(collection(db, "clienti"));
                idCliente = nuovoClienteRef.id;
                batch.set(nuovoClienteRef, { nome: nomeDigitato, telefono: "", note: "Creato al volo da deposito" });
            }

            const cassaRef = doc(db, "casse", idCassa);
            const cassaSnap = await getDoc(cassaRef);

            if (cassaSnap.exists() && cassaSnap.data().stato === "occupata") { 
                alert("Questa cassa è già OCCUPATA da un altro cliente!"); 
                btnConferma.disabled = false; 
                btnConferma.innerText = "Conferma Deposito e Stampa"; 
                return; 
            }

            const qPartita = query(collection(db, "partite"), where("id_cliente", "==", idCliente), where("stato", "==", "aperta"));
            const partiteSnapshot = await getDocs(qPartita);

            let idPartita = "";

            if (partiteSnapshot.empty) {
                const nuovaPartitaRef = doc(collection(db, "partite"));
                idPartita = nuovaPartitaRef.id;
                batch.set(nuovaPartitaRef, { id_cliente: idCliente, stato: "aperta", data_apertura: new Date() });
            } else {
                idPartita = partiteSnapshot.docs[0].id;
            }

            batch.set(cassaRef, { 
                stato: "occupata", 
                id_cliente_attuale: idCliente, 
                id_partita_attuale: idPartita 
            }, { merge: true });
            
            const nuovoDepositoRef = doc(collection(db, "depositi"));
            batch.set(nuovoDepositoRef, { id_partita: idPartita, id_cliente: idCliente, id_cassa: idCassa, data_scarico: new Date() });

            await batch.commit();
            
            // --- STAMPA RICEVUTA ---
            const qCasseAttuali = query(collection(db, "casse"), where("id_partita_attuale", "==", idPartita));
            const casseAttualiSnap = await getDocs(qCasseAttuali);
            let elencoCodici = [];
            casseAttualiSnap.forEach(c => elencoCodici.push(c.id));

            const dataOggi = new Date().toLocaleString('it-IT');
            document.getElementById('print-data').innerText = `Data: ${dataOggi}`;
            document.getElementById('print-cliente').innerText = `Cliente: ${nomeDigitato}`;
            document.getElementById('print-totale-casse').innerText = `Totale Casse: ${elencoCodici.length}`;
            document.getElementById('print-codici').innerText = elencoCodici.join(', ');

            window.print();
            // -----------------------

            inputCassa.value = '';
            inputCassa.focus();
            
            caricaClienti(); 
            caricaPartiteAperte(); 
            aggiornaRiepilogo(); 

        } catch (error) {
            console.error("Errore:", error);
            alert("Errore di salvataggio.");
        }
        btnConferma.disabled = false;
        btnConferma.innerText = "Conferma Deposito e Stampa";
    });
}


// ==========================================
// 4. CHIUSURA MOLITURA
// ==========================================
if (btnChiudiMolitura) {
    btnChiudiMolitura.addEventListener('click', async () => {
        const nomeDigitato = inputMolituraCliente.value.trim().toLowerCase();
        const idPartita = mappaPartiteAperte[nomeDigitato];
        const peso = parseFloat(inputPeso.value);

        if (!idPartita) { 
            alert("Seleziona un cliente valido dalla lista (con casse in attesa nel piazzale)!"); 
            return; 
        }
        if (!peso || peso <= 0) { 
            alert("Inserisci un peso valido in Kg!"); 
            return; 
        }

        btnChiudiMolitura.disabled = true;
        btnChiudiMolitura.innerText = "Lavorazione in corso...";

        try {
            const batch = writeBatch(db);

            const partitaRef = doc(db, "partite", idPartita);
            batch.update(partitaRef, { stato: "molita" });

            const nuovaMolituraRef = doc(collection(db, "moliture"));
            batch.set(nuovaMolituraRef, {
                id_partita: idPartita,
                peso_totale_kg: peso,
                data_molitura: new Date()
            });

            const qCasse = query(collection(db, "casse"), where("id_partita_attuale", "==", idPartita));
            const casseSnapshot = await getDocs(qCasse);

            casseSnapshot.forEach((cassaDoc) => {
                const cassaRef = doc(db, "casse", cassaDoc.id);
                batch.update(cassaRef, {
                    stato: "libera",
                    id_cliente_attuale: null,
                    id_partita_attuale: null
                });
            });

            await batch.commit();

            alert(`Molitura chiusa! Registrati ${peso}kg. Le casse sono tornate libere.`);
            
            inputPeso.value = '';
            inputMolituraCliente.value = '';
            caricaClienti();
            caricaPartiteAperte(); 
            aggiornaRiepilogo(); 

        } catch (error) {
            console.error("Errore chiusura:", error);
            alert("Errore durante la molitura.");
        }

        btnChiudiMolitura.disabled = false;
        btnChiudiMolitura.innerText = "Chiudi Molitura e Libera Casse";
    });
}

// Avvio applicazione
caricaClienti();
caricaPartiteAperte();
aggiornaRiepilogo();