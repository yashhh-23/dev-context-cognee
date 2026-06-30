import os
import base64
from contextvars import ContextVar
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

byok_key_var: ContextVar[Optional[str]] = ContextVar("byok_key", default=None)

PREFIX = "byok_enc:"

def derive_key(passphrase: str, salt: bytes) -> bytes:
    """Derive an AES key from passphrase and salt using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=10000,
    )
    return kdf.derive(passphrase.encode())

def encrypt_data(plain_text: str, passphrase: str) -> str:
    """Encrypt plain text with AES-256-GCM using derived key from passphrase.
    Returns: PREFIX + base64(salt_16bytes + nonce_12bytes + ciphertext)
    """
    if not plain_text or not passphrase:
        return plain_text
    
    try:
        salt = os.urandom(16)
        nonce = os.urandom(12)
        key = derive_key(passphrase, salt)
        
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plain_text.encode(), None)
        
        # Combined payload: salt + nonce + ciphertext
        payload = salt + nonce + ciphertext
        return PREFIX + base64.b64encode(payload).decode('utf-8')
    except Exception as e:
        print(f"[BYOK Encryption Error] {e}")
        return plain_text

def decrypt_data(text: str, passphrase: str) -> str:
    """Decrypt data using AES-256-GCM and derived key.
    Expects format: PREFIX + base64(salt_16bytes + nonce_12bytes + ciphertext)
    """
    if not text:
        return text
    
    if not text.startswith(PREFIX):
        return text
        
    if not passphrase:
        return "[Encrypted Context — Enter Encryption Key to Decrypt]"
    
    try:
        raw_b64 = text[len(PREFIX):]
        payload = base64.b64decode(raw_b64.encode())
        if len(payload) < 28: # 16 (salt) + 12 (nonce)
            return text
        
        salt = payload[:16]
        nonce = payload[16:28]
        ciphertext = payload[28:]
        
        key = derive_key(passphrase, salt)
        aesgcm = AESGCM(key)
        
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"[BYOK Decryption Error] {e}")
        return "[Decryption Failed — Invalid Key or Corrupted Ciphertext]"
