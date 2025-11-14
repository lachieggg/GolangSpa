package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	// Accept port from command line
	port := flag.Int("port", 8080, "Port to run the server on")
	flag.Parse()

	// Initialize database
	db, err := NewSQLiteDB("./app.db")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	handler := &Handler{db: db}

	// Define API routes
	http.HandleFunc("/api/auth/signup", handler.Signup)
	http.HandleFunc("/api/auth/signin", handler.Signin)
	http.HandleFunc("/api/me", handler.Me)
	http.HandleFunc("/api/auth/signout", handler.Signout)

	// Serve static files and handle SPA routing
	fs := http.FileServer(http.Dir("./frontend/build"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fs.ServeHTTP(w, r)
	})

	// Log messages
	fmt.Printf("Server started on http://localhost:%d\n", *port)

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", *port), nil))
}
