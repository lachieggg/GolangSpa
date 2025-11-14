package main

import (
	"database/sql"
	"github.com/google/uuid"
	"time"
)

// Database interface for easy swapping
type Database interface {
	CreateAccount(email, hashedPassword string) error
	GetAccountByEmail(email string) (*Account, error)
	GetAccountByID(id string) (*Account, error)
	CreateSession(accountID, token string, expiresAt time.Time) error
	GetSession(token string) (*Session, error)
	DeleteSession(token string) error
	Close() error
}

// SQLite implementation
type SQLiteDB struct {
	db *sql.DB
}

func (s *SQLiteDB) CreateAccount(email, hashedPassword string) error {
	id := uuid.New().String()
	_, err := s.db.Exec(
		"INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)",
		id, email, hashedPassword,
	)
	return err
}

func (s *SQLiteDB) GetAccountByEmail(email string) (*Account, error) {
	acc := &Account{}
	err := s.db.QueryRow(
		"SELECT id, email, password_hash, created_at FROM accounts WHERE email = ?",
		email,
	).Scan(&acc.ID, &acc.Email, &acc.PasswordHash, &acc.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return acc, err
}

func (s *SQLiteDB) GetAccountByID(id string) (*Account, error) {
	acc := &Account{}
	err := s.db.QueryRow(
		"SELECT id, email, password_hash, created_at FROM accounts WHERE id = ?",
		id,
	).Scan(&acc.ID, &acc.Email, &acc.PasswordHash, &acc.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return acc, err
}

func (s *SQLiteDB) CreateSession(accountID, token string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		"INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)",
		token, accountID, expiresAt,
	)
	return err
}

func (s *SQLiteDB) GetSession(token string) (*Session, error) {
	sess := &Session{}
	err := s.db.QueryRow(
		"SELECT token, account_id, expires_at FROM sessions WHERE token = ? AND expires_at > datetime('now')",
		token,
	).Scan(&sess.Token, &sess.AccountID, &sess.ExpiresAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	return sess, err
}

func (s *SQLiteDB) DeleteSession(token string) error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE token = ?", token)
	return err
}

func (s *SQLiteDB) Close() error {
	return s.db.Close()
}

func NewSQLiteDB(filepath string) (*SQLiteDB, error) {
	db, err := sql.Open("sqlite3", filepath)
	if err != nil {
		return nil, err
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		account_id TEXT NOT NULL,
		expires_at DATETIME NOT NULL,
		FOREIGN KEY (account_id) REFERENCES accounts(id)
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
	`

	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}

	return &SQLiteDB{db: db}, nil
}
