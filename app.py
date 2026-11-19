from flask import Flask, render_template, request

app = Flask(__name__)

@app.route("/")
def index():
    ten = request.args.get("ten", "").strip()[:40]
    bg_card = request.args.get("bg_card", "").strip()
    bg_fw = request.args.get("bg_fw", "").strip()
    return render_template("index.html", ten=ten, bg_card=bg_card, bg_fw=bg_fw)

if __name__ == "__main__":
    app.run(debug=True)
