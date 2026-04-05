// TRAVA DE SEGURANÇA NO TOPO
if (!localStorage.getItem("usuario_logado") && !window.location.href.includes("login.html")) {
    window.location.href = "/";
}

let itensOrcamento = [];
let valorTotal = 0;
const LINK_API = "https://saas-orcamentos.onrender.com";

const hoje = new Date().toLocaleDateString('pt-BR');
if(document.getElementById('data-hoje')) document.getElementById('data-hoje').innerText = hoje;

function adicionarItem() {
    const desc = document.getElementById('desc-item').value;
    const qtd = parseFloat(document.getElementById('qtd-item').value);
    const valor = parseFloat(document.getElementById('valor-item').value);
    if (!desc || isNaN(qtd) || isNaN(valor)) return alert("Preencha tudo!");

    const subtotal = qtd * valor;
    itensOrcamento.push({ descricao: desc, quantidade: qtd, valorUnitario: valor, subtotal: subtotal });
    valorTotal += subtotal;
    atualizarDocumento();
}

function atualizarDocumento() {
    const tbody = document.getElementById('doc-lista-itens');
    tbody.innerHTML = '';
    itensOrcamento.forEach(item => {
        tbody.innerHTML += `<tr><td>${item.descricao}</td><td style="text-align:center">${item.quantidade}</td><td style="text-align:right">R$ ${item.valorUnitario.toFixed(2)}</td><td style="text-align:right">R$ ${item.subtotal.toFixed(2)}</td></tr>`;
    });
    document.getElementById('doc-total').innerText = valorTotal.toFixed(2).replace('.', ',');
}

async function checarPaywall(acao) {
    const email = localStorage.getItem("usuario_logado");
    try {
        const res = await fetch(`${LINK_API}/verificar_limite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        if (res.ok) {
            acao === 'pdf' ? gerarPDF() : enviarWhatsApp();
        } else if (res.status === 402) {
            alert("Limite atingido! Redirecionando para Upgrade...");
            window.location.href = "/pagamento";
        }
    } catch (e) { alert("Erro de conexão."); }
}

function gerarPDF() {
    const element = document.getElementById('documento-orcamento');
    html2pdf().from(element).save(`Orcamento.pdf`);
}

function enviarWhatsApp() {
    const tel = document.getElementById('telefone-cliente').value;
    if(!tel) return alert("Informe o WhatsApp");
    let msg = encodeURIComponent(`Olá! Seu orçamento total é R$ ${valorTotal.toFixed(2)}`);
    window.open(`https://wa.me/${tel.replace(/\D/g, '')}?text=${msg}`, '_blank');
}
