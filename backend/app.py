from tanimtech import create_app

app = create_app()

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 3000))
    print(f"TanimTech running at http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
