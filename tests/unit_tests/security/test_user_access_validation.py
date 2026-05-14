import pytest

def validate_user_access(password, user_is_active, user_is_locked):
    is_password_valid = 6 <= len(password) <= 255

    if is_password_valid and user_is_active and not user_is_locked:
        return True
    return False


@pytest.mark.parametrize("password, expected", [
    ("12345", False),  
    ("123456", True),  
    ("a" * 255, True),  
    ("a" * 256, False),  
])
def test_password_boundary_validation(password, expected):
    """
    Justificativa: Valida os limites exatos da especificação funcional.
    Técnica: AVL (Análise de Valor Limite).
    """
    assert validate_user_access(password, True, False) == expected


def test_account_status_logic_coverage():
    password = "valid_password_123"

    assert validate_user_access(password, True, user_is_locked=True) is False

    assert validate_user_access(password, user_is_active=False, user_is_locked=False) is False