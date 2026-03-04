const API_URL = 'http://localhost:3000/api';

const authSection = document.getElementById('auth-section');
const notasSection = document.getElementById('notas-section');
const listaNotas = document.getElementById('lista-notas');

// --- GESTIÓN DE ESTADO ---
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        authSection.style.display = 'none';
        notasSection.style.display = 'block';
        cargarNotas();
    } else {
        authSection.style.display = 'block';
        notasSection.style.display = 'none';
    }
}

// --- REGISTRO ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if(res.ok) document.getElementById('register-form').reset();
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
});

// --- LOGIN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token); // Guardamos la "llave"
            checkAuth(); // Cambiamos la vista
        } else {
            alert(data.error || "Credenciales incorrectas");
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
});

// --- LOGOUT ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    checkAuth();
});

// --- CARGAR NOTAS (CON PROTECCIÓN XSS) ---
async function cargarNotas() {
    try {
        const res = await fetch(`${API_URL}/notas`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (res.ok) {
            const notas = await res.json();
            listaNotas.innerHTML = ''; // Limpiamos la lista
            
            notas.forEach(nota => {
                // Creamos los elementos de forma segura para evitar XSS
                const card = document.createElement('div');
                card.className = 'nota-card';
                
                const titulo = document.createElement('h4');
                titulo.className = 'nota-titulo';
                titulo.textContent = nota.titulo; // textContent sanitiza el texto
                
                const contenido = document.createElement('p');
                contenido.className = 'nota-contenido';
                contenido.textContent = nota.contenido; 
                
                card.appendChild(titulo);
                card.appendChild(contenido);
                listaNotas.appendChild(card);
            });
        } else {
            // Si el token expiró o es inválido, forzamos salida
            localStorage.removeItem('token');
            checkAuth();
        }
    } catch (error) {
        console.error("Error cargando notas:", error);
    }
}

// --- CREAR NOTA ---
document.getElementById('nota-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('nota-titulo').value;
    const contenido = document.getElementById('nota-contenido').value;

    try {
        const res = await fetch(`${API_URL}/notas`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ titulo, contenido })
        });

        if (res.ok) {
            document.getElementById('nota-form').reset(); // Limpiar formulario
            cargarNotas(); // Refrescar lista
        } else {
            const data = await res.json();
            alert(data.error || "Error al crear la nota");
        }
    } catch (error) {
        alert("Error de conexión.");
    }
});

// --- INICIALIZACIÓN ---
checkAuth();
