let itensOrcamento = [];
let valorTotal = 0;

const hoje = new Date().toLocaleDateString('pt-BR');
document.getElementById('data-hoje').innerText = hoje;

document.getElementById('nome-cliente').addEventListener('input', function(e) {
    const nome = e.target.value;
    document.getElementById('doc-cliente-nome').innerText = nome ? nome : 'Nenhum cliente informado';
});

function adicionarItem() {
    const desc = document.getElementById('desc-item').value;
    const qtd = parseFloat(document.getElementById('qtd-item').value);
    const valor = parseFloat(document.getElementById('valor-item').value);

    if (!desc || isNaN(qtd) || isNaN(valor)) {
        alert("Preencha a descrição, quantidade e valor corretamente.");
        return;
    }

    const subtotal = qtd * valor;
    itensOrcamento.push({ descricao: desc, quantidade: qtd, valorUnitario: valor, subtotal: subtotal });
    valorTotal += subtotal;

    atualizarDocumento();

    document.getElementById('desc-item').value = '';
    document.getElementById('qtd-item').value = '1';
    document.getElementById('valor-item').value = '';
}

function atualizarDocumento() {
    const tbody = document.getElementById('doc-lista-itens');
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
    document.getElementById('doc-total').innerText = valorTotal.toFixed(2).replace('.', ',');
}

// ==========================================
// A CATRACA (VERIFICA O LIMITE NO BACK-END)
// ==========================================
async function checarPaywall(acao) {
    const emailUsuario = localStorage.getItem("usuario_logado");

    if (!emailUsuario) {
        alert("Você precisa fazer login para gerar orçamentos!");
        window.location.href = "login.html"; // Manda de volta pro login
        return;
    }

    try {
        const resposta = await fetch('http://127.0.0.1:8000/verificar_limite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            // Tem crédito! Libera a ação solicitada
            if (acao === 'pdf') gerarPDF();
            if (acao === 'whatsapp') enviarWhatsApp();
        } else {
            // Bateu no Paywall!
            if (resposta.status === 402) {
                alert("🔒 " + dados.detail + "\n\nRedirecionando para a tela de Upgrade...");
                
                // ESSA É A LINHA QUE TROCA DE TELA:
                window.location.href = "pagamento.html"; 
            } else {
                alert("Erro: " + dados.detail);
            }
        }
    } catch (erro) {
        alert("Erro ao conectar com o servidor.");
        console.error(erro);
    }
}

// Funções Originais
function gerarPDF() {
    const elemento = document.getElementById('documento-orcamento');
    const nomeCliente = document.getElementById('nome-cliente').value || 'Cliente';
    const opcoes = { margin: 0, filename: `Orcamento_${nomeCliente}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opcoes).from(elemento).save();
}

function enviarWhatsApp() {
    const nomeCliente = document.getElementById('nome-cliente').value || 'Cliente';
    const telefoneCliente = document.getElementById('telefone-cliente').value;
    if (!telefoneCliente) { alert("Informe o WhatsApp do cliente para enviar."); return; }
    if (itensOrcamento.length === 0) { alert("O orçamento está vazio."); return; }

    let mensagem = `Olá, *${nomeCliente}*!\n\nAqui está o resumo do seu orçamento gerado em ${hoje}:\n\n`;
    itensOrcamento.forEach(item => { mensagem += `🔹 *${item.descricao}*\nQtd: ${item.quantidade} | Un: R$ ${item.valorUnitario.toFixed(2)} | Sub: R$ ${item.subtotal.toFixed(2)}\n\n`; });
    mensagem += `*TOTAL DO ORÇAMENTO: R$ ${valorTotal.toFixed(2)}*\n\nSe aprovado, por favor nos confirme. Qualquer dúvida, estamos à disposição.`;
    
    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = telefoneCliente.replace(/\D/g, ''); 
    window.open(`https://wa.me/${telefoneLimpo}?text=${mensagemCodificada}`, '_blank');
}