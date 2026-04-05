// LINK DO RENDER
const LINK_API = "https://saas-orcamentos.onrender.com";

// 1. TRANCA DE SEGURANÇA
if (!localStorage.getItem("usuario_logado") && !window.location.pathname.includes("login")) {
    window.location.href = "/";
}

let itensOrcamento = [];
let valorTotal = 0;

// Só executa o código abaixo quando a página carregar inteira
window.onload = function() {
    console.log("Sistema de Orçamentos carregado!");
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    if(document.getElementById('data-hoje')) {
        document.getElementById('data-hoje').innerText = hoje;
    }

    if(document.getElementById('nome-cliente')) {
        document.getElementById('nome-cliente').addEventListener('input', function(e) {
            document.getElementById('doc-cliente-nome').innerText = e.target.value || 'Nenhum cliente informado';
        });
    }
};

// FUNÇÃO DE ADICIONAR ITEM (O MOTOR)
function adicionarItem() {
    console.log("Botão de adicionar clicado!"); // Isso aparece no F12

    const descInput = document.getElementById('desc-item');
    const qtdInput = document.getElementById('qtd-item');
    const valorInput = document.getElementById('valor-item');

    if (!descInput || !qtdInput || !valorInput) {
        console.error("Erro: Campos de entrada não encontrados no HTML!");
        return;
    }

    const desc = descInput.value;
    const qtd = parseFloat(qtdInput.value);
    const valor = parseFloat(valorInput.value);

    if (!desc || isNaN(qtd) || isNaN(valor)) {
        alert("Por favor, preencha a descrição, quantidade e valor!");
        return;
    }

    const subtotal = qtd * valor;
    itensOrcamento.push({ 
        descricao: desc, 
        quantidade: qtd, 
        valorUnitario: valor, 
        subtotal: subtotal 
    });
    
    valorTotal += subtotal;
    atualizarDocumento();

    // Limpa os campos para o próximo item
    descInput.value = '';
    qtdInput.value = '1';
    valorInput.value = '';
}

function atualizarDocumento() {
    const tbody = document.getElementById('doc-lista-itens');
    const totalSpan = document.getElementById('doc-total');

    if (!tbody || !totalSpan) return;

    tbody.innerHTML = '';
    itensOrcamento.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${item.descricao}</td>
                <td style="text-align: center;">${item.quantidade}</td>
                <td style="text-align: right;">R$ ${item.valorUnitario.toFixed(2).replace('.', ',')}</td>
                <td style="text-align: right;">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });

    totalSpan.innerText = valorTotal.toFixed(2).replace('.', ',');
}

// Funções de Paywall e PDF (Mantidas)
async function checarPaywall(acao) {
    const emailUsuario = localStorage.getItem("usuario_logado");
    try {
        const resposta = await fetch(`${LINK_API}/verificar_limite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario })
        });
        if (resposta.ok) {
            acao === 'pdf' ? gerarPDF() : enviarWhatsApp();
        } else if (resposta.status === 402) {
            window.location.href = "/pagamento"; 
        }
    } catch (erro) {
        alert("Erro de conexão com o servidor.");
    }
}

function gerarPDF() {
    const elemento = document.getElementById('documento-orcamento');
    const opcoes = { margin: 0, filename: 'Orcamento.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4' } };
    html2pdf().set(opcoes).from(elemento).save();
}

function enviarWhatsApp() {
    const nome = document.getElementById('nome-cliente').value || 'Cliente';
    const tel = document.getElementById('telefone-cliente').value;
    if (!tel) return alert("Informe o WhatsApp");
    let msg = encodeURIComponent(`Olá, ${nome}! Total: R$ ${valorTotal.toFixed(2)}`);
    window.open(`https://wa.me/${tel.replace(/\D/g, '')}?text=${msg}`, '_blank');
}
