from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
import models
import mercadopago
import uuid  # Para gerar chaves de transação únicas
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="SaaS de Orçamentos API")

# Configuração do Mercado Pago (Com o seu Token)
sdk = mercadopago.SDK("APP_USR-127374858769532-040423-f3a30250b98093c7f0b6dc9926ec86eb-81304613")

# Permite que o Front-end converse com o Back-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Conexão com Banco de Dados
def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Modelos de Dados (Pydantic)
class UsuarioCriar(BaseModel):
    email: str
    senha: str

class SolicitarOrcamento(BaseModel):
    email: str

class DadosPagamento(BaseModel):
    email: str
    plano: str

# --- ROTAS DO SISTEMA ---

@app.post("/cadastrar", status_code=status.HTTP_201_CREATED)
def cadastrar_usuario(user: UsuarioCriar, db: Session = Depends(get_db)):
    usuario_existente = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    senha_criptografada = pwd_context.hash(user.senha)
    novo_usuario = models.Usuario(email=user.email, senha_hash=senha_criptografada)
    
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return {"mensagem": "Conta criada com sucesso!", "plano": novo_usuario.plano}

@app.post("/login")
def login(user: UsuarioCriar, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if not usuario or not pwd_context.verify(user.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    
    return {
        "mensagem": "Login efetuado com sucesso!", 
        "plano": usuario.plano
    }

@app.post("/verificar_limite")
def verificar_limite_e_contar(dados: SolicitarOrcamento, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == dados.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if usuario.plano == "Gratis" and usuario.orcamentos_feitos >= 1:
        raise HTTPException(status_code=402, detail="Limite gratuito atingido!")
    elif usuario.plano == "Basico" and usuario.orcamentos_feitos >= 5:
        raise HTTPException(status_code=402, detail="Limite do plano Básico atingido!")

    usuario.orcamentos_feitos += 1
    db.commit()
    return {"mensagem": "Liberado!"}

# --- ROTA DO PIX ---

@app.post("/gerar_pix")
def gerar_pix(dados: DadosPagamento):
    valor = 10.00 if dados.plano == "Basico" else 30.00

    payment_data = {
        "transaction_amount": float(valor),
        "description": f"Plano {dados.plano} - SaaS Orcamentos",
        "payment_method_id": "pix",
        "payer": {
            "email": dados.email,
            "first_name": "Cliente",
            "last_name": "Teste"
        }
    }
    
    request_options = mercadopago.config.RequestOptions()
    request_options.custom_headers = {'x-idempotency-key': str(uuid.uuid4())}

    try:
        result = sdk.payment().create(payment_data, request_options)
        payment = result.get("response")

        if payment and "id" in payment:
            return {
                "codigo_copia_cola": payment["point_of_interaction"]["transaction_data"]["qr_code"],
                "qr_code_imagem": payment["point_of_interaction"]["transaction_data"]["qr_code_base64"],
                "payment_id": payment["id"]
            }
        else:
            raise HTTPException(status_code=400, detail="Erro no Mercado Pago")

    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro interno no servidor")

@app.post("/webhook")
async def receber_notificacao(id: str = None, topic: str = None, db: Session = Depends(get_db)):
    if topic == "payment" and id:
        try:
            result = sdk.payment().get(id)
            payment_info = result.get("response")

            if payment_info and payment_info.get("status") == "approved":
                email_cliente = payment_info["payer"]["email"]
                descricao = payment_info["description"]

                usuario = db.query(models.Usuario).filter(models.Usuario.email == email_cliente).first()
                
                if usuario:
                    if "Basico" in descricao:
                        usuario.plano = "Basico"
                    elif "Ilimitado" in descricao:
                        usuario.plano = "Ilimitado"
                    
                    db.commit()
        except Exception as e:
            print(f"Erro no webhook: {e}")
            
    return {"status": "ok"}

# --- AS LINHAS MÁGICAS PARA O FRONT-END ---

# Faz o FastAPI servir seus arquivos de estilo e scripts
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def principal():
    # Isso faz o link principal abrir o seu arquivo HTML bonitão
    return FileResponse("index.html")
