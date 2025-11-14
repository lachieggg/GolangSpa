package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

// mockDB
type mockDB struct {
	accounts map[string]*Account
	sessions map[string]*Session
	err      error
}

// newMockDB
func newMockDB() *mockDB {
	return &mockDB{
		accounts: make(map[string]*Account),
		sessions: make(map[string]*Session),
	}
}

// CreateAccount
func (m *mockDB) CreateAccount(email, hashedPassword string) error {
	if m.err != nil {
		return m.err
	}
	m.accounts[email] = &Account{
		ID:           "test-id",
		Email:        email,
		PasswordHash: hashedPassword,
		CreatedAt:    time.Now(),
	}
	return nil
}

// GetAccountByEmail
func (m *mockDB) GetAccountByEmail(email string) (*Account, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.accounts[email], nil
}

// GetAccountByID
func (m *mockDB) GetAccountByID(id string) (*Account, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, acc := range m.accounts {
		if acc.ID == id {
			return acc, nil
		}
	}
	return nil, nil
}

// CreateSession
func (m *mockDB) CreateSession(accountID, token string, expiresAt time.Time) error {
	if m.err != nil {
		return m.err
	}
	m.sessions[token] = &Session{
		Token:     token,
		AccountID: accountID,
		ExpiresAt: expiresAt,
	}
	return nil
}

// GetSession
func (m *mockDB) GetSession(token string) (*Session, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.sessions[token], nil
}

// DeleteSession
func (m *mockDB) DeleteSession(token string) error {
	if m.err != nil {
		return m.err
	}
	delete(m.sessions, token)
	return nil
}

// Close
func (m *mockDB) Close() error {
	return nil
}

// TestSignup tests the Signup handler.
// - success: valid email and password creates account
// - duplicate email: returns conflict when account exists
// - invalid method: rejects non-POST requests
// - missing fields: rejects empty email or password
func TestSignup(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		body       SignupRequest
		setupDB    func(*mockDB)
		wantStatus int
	}{
		{
			name:       "success",
			method:     http.MethodPost,
			body:       SignupRequest{Email: "test@test.com", Password: "password123"},
			wantStatus: http.StatusCreated,
		},
		{
			name:   "duplicate email",
			method: http.MethodPost,
			body:   SignupRequest{Email: "test@test.com", Password: "password123"},
			setupDB: func(db *mockDB) {
				hash, _ := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
				db.accounts["test@test.com"] = &Account{Email: "test@test.com", PasswordHash: string(hash)}
			},
			wantStatus: http.StatusConflict,
		},
		{
			name:       "invalid method",
			method:     http.MethodGet,
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "missing fields",
			method:     http.MethodPost,
			body:       SignupRequest{Email: "", Password: ""},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newMockDB()
			if tt.setupDB != nil {
				tt.setupDB(db)
			}
			h := &Handler{db: db}

			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(tt.method, "/signup", bytes.NewBuffer(body))
			w := httptest.NewRecorder()

			h.Signup(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// TestSignin tests the Signin handler.
// - success: correct credentials creates session and sets cookie
// - invalid credentials: wrong password returns unauthorized
// - invalid method: rejects non-POST requests
func TestSignin(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		body       SigninRequest
		setupDB    func(*mockDB)
		wantStatus int
		wantCookie bool
	}{
		{
			name:   "success",
			method: http.MethodPost,
			body:   SigninRequest{Email: "test@test.com", Password: "password123"},
			setupDB: func(db *mockDB) {
				hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				db.accounts["test@test.com"] = &Account{ID: "test-id", Email: "test@test.com", PasswordHash: string(hash)}
			},
			wantStatus: http.StatusOK,
			wantCookie: true,
		},
		{
			name:       "invalid credentials",
			method:     http.MethodPost,
			body:       SigninRequest{Email: "test@test.com", Password: "wrong"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid method",
			method:     http.MethodGet,
			wantStatus: http.StatusMethodNotAllowed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newMockDB()
			if tt.setupDB != nil {
				tt.setupDB(db)
			}
			h := &Handler{db: db}

			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(tt.method, "/signin", bytes.NewBuffer(body))
			w := httptest.NewRecorder()

			h.Signin(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantCookie {
				cookies := w.Result().Cookies()
				require.NotEmpty(t, cookies)
				assert.Equal(t, "session_token", cookies[0].Name)
			}
		})
	}
}

// TestMe tests the Me handler.
// - success: valid session returns account info
// - no cookie: missing session cookie returns unauthorized
// - invalid session: non-existent session token returns unauthorized
func TestMe(t *testing.T) {
	tests := []struct {
		name       string
		setupDB    func(*mockDB)
		cookie     *http.Cookie
		wantStatus int
	}{
		{
			name: "success",
			setupDB: func(db *mockDB) {
				db.accounts["test@test.com"] = &Account{ID: "test-id", Email: "test@test.com"}
				db.sessions["valid-token"] = &Session{Token: "valid-token", AccountID: "test-id"}
			},
			cookie:     &http.Cookie{Name: "session_token", Value: "valid-token"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "no cookie",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid session",
			cookie:     &http.Cookie{Name: "session_token", Value: "invalid"},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newMockDB()
			if tt.setupDB != nil {
				tt.setupDB(db)
			}
			h := &Handler{db: db}

			req := httptest.NewRequest(http.MethodGet, "/me", nil)
			if tt.cookie != nil {
				req.AddCookie(tt.cookie)
			}
			w := httptest.NewRecorder()

			h.Me(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// TestSignout tests the Signout handler.
// - success: valid session is deleted and cookie cleared
// - no cookie: missing session cookie returns bad request
func TestSignout(t *testing.T) {
	tests := []struct {
		name       string
		setupDB    func(*mockDB)
		cookie     *http.Cookie
		wantStatus int
	}{
		{
			name: "success",
			setupDB: func(db *mockDB) {
				db.sessions["valid-token"] = &Session{Token: "valid-token"}
			},
			cookie:     &http.Cookie{Name: "session_token", Value: "valid-token"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "no cookie",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newMockDB()
			if tt.setupDB != nil {
				tt.setupDB(db)
			}
			h := &Handler{db: db}

			req := httptest.NewRequest(http.MethodPost, "/signout", nil)
			if tt.cookie != nil {
				req.AddCookie(tt.cookie)
			}
			w := httptest.NewRecorder()

			h.Signout(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				_, exists := db.sessions["valid-token"]
				assert.False(t, exists, "expected session to be deleted")
			}
		})
	}
}
