<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="stylesheet" href="/src/css/font.css" />
    <link rel="stylesheet" href="/src/css/style.css?v=109" />
    <title>Login | Nabua Water Inventory</title>
  </head>
  <body class="login-body">
    <div class="login-container">
      <div class="login-card">
        <div class="login-card__logo">
          <img src="/assets/images/waterlogo.svg" alt="Nabua Water Inventory Logo" class="login-card__logo-img" />
          <h1 class="login-card__title">Nabua Water Inventory</h1>
          <p class="login-card__subtitle">Sign in to your account</p>
        </div>

        <form class="login-card__form" id="loginForm">
          <div class="login-card__field">
            <label for="loginUsername">Username</label>
            <div class="login-card__input-wrapper">
              <svg class="login-card__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input type="text" id="loginUsername" placeholder="Enter your username" autocomplete="username" required />
            </div>
          </div>

          <div class="login-card__field">
            <label for="loginPassword">Password</label>
            <div class="login-card__input-wrapper login-card__input-wrapper--password">
              <svg class="login-card__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input type="password" id="loginPassword" placeholder="Enter your password" autocomplete="current-password" required />
              <button type="button" class="login-card__toggle-password" id="loginPasswordToggle" aria-label="Show password" aria-pressed="false" title="Show password">
                <svg class="login-card__toggle-icon" id="loginPasswordShowIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg class="login-card__toggle-icon --hidden" id="loginPasswordHideIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.16 3.19"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="login-card__error --hidden" id="loginError">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span id="loginErrorText">Invalid credentials</span>
          </div>

          <button type="submit" class="login-card__btn" id="loginBtn">
            <span class="login-card__btn-text">Sign In</span>
            <div class="login-card__btn-spinner --hidden" id="loginSpinner"></div>
          </button>
        </form>

        <div class="login-card__footer">
          <p>Authorized personnel only</p>
        </div>
      </div>
    </div>

    <script>
      const form = document.getElementById('loginForm');
      const errorBox = document.getElementById('loginError');
      const errorText = document.getElementById('loginErrorText');
      const loginBtn = document.getElementById('loginBtn');
      const btnText = loginBtn.querySelector('.login-card__btn-text');
      const spinner = document.getElementById('loginSpinner');

      const usernameInput = document.getElementById('loginUsername');
      const passwordInput = document.getElementById('loginPassword');
      const passwordToggle = document.getElementById('loginPasswordToggle');
      const passwordShowIcon = document.getElementById('loginPasswordShowIcon');
      const passwordHideIcon = document.getElementById('loginPasswordHideIcon');

      const hideError = () => errorBox.classList.add('--hidden');

      usernameInput.addEventListener('input', hideError);
      passwordInput.addEventListener('input', hideError);

      passwordToggle.addEventListener('click', () => {
        const visible = passwordInput.type === 'password';
        passwordInput.type = visible ? 'text' : 'password';
        passwordShowIcon.classList.toggle('--hidden', visible);
        passwordHideIcon.classList.toggle('--hidden', !visible);
        passwordToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
        passwordToggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
        passwordToggle.title = visible ? 'Hide password' : 'Show password';
        passwordInput.focus();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        btnText.textContent = 'Signing in...';
        spinner.classList.remove('--hidden');
        loginBtn.disabled = true;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            window.location.href = '/';
            return;
          }
          if (res.status === 401) {
            errorText.textContent = data.error || 'Invalid credentials';
            errorBox.classList.remove('--hidden');
          } else {
            errorText.textContent = data.error || 'Unable to sign in. Please try again.';
            errorBox.classList.remove('--hidden');
          }
        } catch (err) {
          errorText.textContent = 'Connection error. Please try again.';
          errorBox.classList.remove('--hidden');
        } finally {
          btnText.textContent = 'Sign In';
          spinner.classList.add('--hidden');
          loginBtn.disabled = false;
        }
      });
    </script>
  </body>
</html>
