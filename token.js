exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const {
    DROPBOX_APP_KEY,
    DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN
  } = process.env;

  try {
    const body = JSON.parse(event.body || '{}');

    // ── Mode 1: Exchange auth code for tokens (first login) ──
    if (body.code) {
      const params = new URLSearchParams({
        code: body.code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
        redirect_uri: body.redirect_uri,
        code_verifier: body.code_verifier
      });

      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      const data = await res.json();

      if (!data.access_token) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: data.error_description || 'OAuth failed' })
        };
      }

      // Return access_token + refresh_token to client
      // Client will show refresh_token in admin panel so operator can save it
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token || null,
          expires_in: data.expires_in
        })
      };
    }

    // ── Mode 2: Refresh access token using stored refresh token ──
    if (body.refresh) {
      if (!DROPBOX_REFRESH_TOKEN) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No refresh token configured. Please reconnect via ?admin.' })
        };
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: DROPBOX_REFRESH_TOKEN,
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET
      });

      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      const data = await res.json();

      if (!data.access_token) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Token refresh failed. Please reconnect via ?admin.' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ access_token: data.access_token })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request' })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
