from flask import Flask,request,jsonify
from flask_sqlalchemy import SQLAlchemy
import secrets

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db=SQLAlchemy(app)

class users(db.Model):
    _id=db.Column(db.Integer,primary_key=True)
    username=db.Column(db.String(64))
    password=db.Column(db.String(64))
    token=db.Column(db.String(64))
    def __init__(self,username,password,token):
        self.username=username
        self.password=password
        self.token=token

class history(db.Model):
    _id=db.Column(db.Integer,primary_key=True)
    url=db.Column(db.String(64))
    title=db.Column(db.String(64))
    body=db.Column(db.text)
    summary=db.Column(db.text)
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

@app.route("/register",methods=["POST"])
def register():
    data=request.json
    username=data['username']
    password=data['password']
    if username in users:
        return jsonify({"Error:Username already exists"})
    else:
        token=generate_token()
        db.session.add(users(username,password,token))
        db.session.commit()
        return jsonify({"message":"Registered Successfully","username":username,"token":token})
    

    
@app.route("/login",methods=['POST'])
def login():
    data=request.json
    username=data['username']
    password=data['password']
    user=users.query.filter_by(username=username).first
    if not user or user['password']!=password:
        return jsonify({"Error:Wrong credential entered"})
    else:
        return jsonify({"message":"Login successful","username":username,"token":user.token})
    

@app.route("/add",methods=['POST'])
def add():
    data=request.json
    token=data['token']
    user=users.query.find_by(token=token).first
    if not user:
        return jsonify({"Error, Invalid user id"})
    hist=history(data['url'],data['title'],data['body'],data['summary'],user.id)
    db.session.add(hist)
    db.session.commit()

    return jsonify({"Content added successfully"})

@app.route("/view",methods=['POST'])
def view():
    data=request.json
    user=users.query.find_by(username=data['username']).first
    if not user:
        return jsonify({"Error:Invalid username"})
    hist=history.query.find_by(user_id=user.id).all()
    c=[]
    for i in hist:
        a={"url":i.url,"title":i.title,"body":i.body,"summary":i.summary,"userid":i.user_id}
        c.append(a)

    return jsonify({"username":user.username,"content":c})

if __name__ == '__main__':
    db.create_all()
    app.run(debug=True)


