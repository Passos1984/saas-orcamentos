from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Cria o arquivo do banco de dados na mesma pasta
SQLALCHEMY_DATABASE_URL = "sqlite:///./saas_orcamentos.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Aqui definimos a Tabela de Usuários
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=True)
    plano = Column(String, default="Gratis")   # Gratis, Basico, Ilimitado
    orcamentos_feitos = Column(Integer, default=0)

# Cria as tabelas no banco de dados automaticamente
Base.metadata.create_all(bind=engine)