from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
import models
import mercadopago
import uuid
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="SaaS de Orçamentos API")

sdk = mercadopago.SDK("APP_USR-127374858769532-040423-f3a30250b98093c7f0b6dc9926ec86eb-81304613")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UsuarioCriar(BaseModel):
    email: str
    senha: str

class SolicitarOrcamento(BaseModel):
    email: str

class DadosPagamento(BaseModel):
    email: str
    plano: str

# --- ROTAS DE API ---
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
    return {"mensagem": "Conta criada!", "plano": novo_usuario.plano}

@app.post("/login")
def login(user: UsuarioCriar, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if not usuario or not pwd_context.verify(user.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    return {"mensagem": "Sucesso!", "plano": usuario.plano}

@app.post("/verificar_limite")
def verificar_limite(dados: SolicitarOrcamento, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == dados.email).first()
    if not usuario: raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario.plano == "Gratis" and usuario.orcamentos_feitos >= 1:
        raise HTTPException(status_code=402, detail="Limite gratuito atingido!")
    usuario.orcamentos_feitos += 1
    db.commit()
    return {"mensagem": "Liberado!"}

@app.post("/gerar_pix")
def gerar_pix(dados: DadosPagamento):
    valor = 10.00 if dados.plano == "Basico" else 30.00
    payment_data = {
        "transaction_amount": float(valor),
        "description": f"Plano {dados.plano}",
        "payment_method_id": "pix",
        "payer": {"email": dados.email, "first_name": "Cliente"}
    }
    request_options = mercadopago.config.RequestOptions()
    request_options.custom_headers = {'x-idempotency-key': str(uuid.uuid4())}
    result = sdk.payment().create(payment_data, request_options)
    payment = result.get("response")
    return {
        "codigo_copia_cola": payment["point_of_interaction"]["transaction_data"]["qr_code"],
        "qr_code_imagem": payment["point_of_interaction"]["transaction_data"]["qr_code_base64"]
    }

# --- NAVEGAÇÃO DO FRONTEND ---
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def principal():
    return FileResponse("login.html")

@app.get("/painel")
async def abrir_painel():
    return FileResponse("index.html")

@app.get("/pagamento")
async def abrir_pagamento():
    return FileResponse("pagamento.html")
