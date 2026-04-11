# test_verify.py
import hashlib
import base64

# Your actual hash from database
stored_hash = "pbkdf2_sha256$600000$m5-qalWlybnczbUV5Fr_DA$84qyzYPdw2IiDTWYik8o57N7FLnZXsJMuNXHnKZ8n3o"
password = "secure123"

print(f"Testing password: '{password}'")
print(f"Hash: {stored_hash}\n")

try:
    # Parse the hash
    algorithm, iterations, salt, hash_encoded = stored_hash.split("$", 3)
    print(f"Algorithm: {algorithm}")
    print(f"Iterations: {iterations}")
    print(f"Salt: {salt}")
    print(f"Encoded hash: {hash_encoded}")

    # Fix base64 padding
    padding_needed = (4 - len(hash_encoded) % 4) % 4
    hash_padded = hash_encoded + "=" * padding_needed
    print(f"Padded hash: {hash_padded}")

    # Decode stored hash
    stored_bytes = base64.b64decode(hash_padded.encode())
    print(f"Stored hash bytes (hex): {stored_bytes.hex()}")

    # Compute hash of password
    computed_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        int(iterations),
        dklen=32
    )
    print(f"Computed hash bytes (hex): {computed_bytes.hex()}")

    # Compare
    match = hashlib.compare_digest(stored_bytes, computed_bytes)
    print(f"\n✅ MATCH!" if match else f"\n❌ NO MATCH")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback

    traceback.print_exc()