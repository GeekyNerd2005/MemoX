from flask import Flask,request,jsonify,render_template,url_for,redirect,make_response
from flask_sqlalchemy import SQLAlchemy
import secrets

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db=SQLAlchemy(app)

class users(db.Model):
    _id=db.Column(db.Integer,primary_key=True)
    username=db.Column(db.String(64))
    email=db.Column(db.String(64))
    password=db.Column(db.String(64))
    token=db.Column(db.String(64))
    def __init__(self,username,email,password,token):
        self.username=username
        self.password=password
        self.email=email
        self.token=token

class history(db.Model):
    _id=db.Column(db.Integer,primary_key=True)
    url=db.Column(db.String(64))
    title=db.Column(db.String(64))
    body=db.Column(db.Text)
    summary=db.Column(db.Text)
    user_id=db.Column(db.Integer)
    def __init__(self,url,title,body,summary,user_id):
        self.url=url
        self.title=title
        self.body=body
        self.summary=summary
        self.user_id=user_id


def generate_token():
    token=secrets.token_hex(16)
    return token

@app.route("/")
def index():
    return render_template("login.html")

@app.route("/home")
def home():
    token=request.args.get("token")
    return render_template("home.html",token=token)

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        email = request.form["email"]
        password = request.form["password"]

        if users.query.filter_by(username=username).first():
            return render_template("register.html", error="Username already exists")

        token = generate_token()
        new_user = users(username,email, password, token)
        db.session.add(new_user)
        db.session.commit()
        response = make_response(render_template("home.html", token=token))
        response.set_cookie("user_token",token)
        return response

    return render_template("register.html")



@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = users.query.filter_by(username=username).first()
        if not user or user.password != password:
            return render_template("login.html", error="Wrong credentials")
        
        response = make_response(render_template("home.html", token=user.token))
        response.set_cookie("user_token", user.token)
        return response

    return render_template("login.html")



@app.route("/add", methods=['POST'])
def add():
    data = request.json
    token = data.get('token')
    user = users.query.filter_by(token=token).first()
    if not user:
        return jsonify({"error": "Invalid user token"})

    hist = history(
        url=data.get('url'),
        title=data.get('title'),
        body=data.get('body'),
        summary=data.get('summary'),
        user_id=user._id
    )
    db.session.add(hist)
    db.session.commit()

    return jsonify({"message": "Content added successfully"})


@app.route("/view",methods=['POST'])
def view():
    data=request.json
    user=users.query.find_by(username=data['username']).first()
    if not user:
        return jsonify({"Error:Invalid username"})
    hist=history.query.find_by(user_id=user.id).all()
    c=[]
    for i in hist:
        a={"url":i.url,"title":i.title,"body":i.body,"summary":i.summary,"userid":i.user_id}
        c.append(a)

    return jsonify({"username":user.username,"content":c})

@app.route("/debug/history")
def debug_history():
    all_entries = history.query.all()
    
    if not all_entries:
        return " No history entries found in the database."

    html = "<h2>Stored Summaries:</h2><ul>"
    for h in all_entries:
        html += f"<li><strong>{h.title}</strong><br>URL: {h.url}<br>Summary: {h.summary[:100]}...</li><hr>"
    html += "</ul>"

    return html

@app.route("/debug/users")
def debug_users():
    all_entries = users.query.all()
    
    if not all_entries:
        return " No history entries found in the database."

    html = "<h2>Stored Summaries:</h2><ul>"
    for h in all_entries:
        html += f"<li><strong>{h.username}</strong><br>email: {h.email}<br>password: {h.password}...</li><hr>"
    html += "</ul>"

    return html


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True,port=5001)



