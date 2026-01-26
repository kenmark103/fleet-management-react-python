from passlib.context import CryptContext

pwdContext = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwdContext.hash(password)

def verify_password(plain_password: str, hashed_password: str)->bool:
    return pwdContext.verify(plain_password, hashed_password)
