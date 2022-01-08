const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();
const {MongoClient} = require('mongodb');

const port = process.env.PORT || 5000;

const serviceAccount = require('./car-sales-website-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// midleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fmq8a.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken (req, res, next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch{}
    }
    next();
}

async function run(){
    try{
        await client.connect();
        const database = client.db('car__sales');
        const productsCollection = database.collection('products');
        const usersCollection = database.collection('users');

        // GET ALL PRODUCT
        app.get('/products', async(req, res)=>{
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        });

        // GET SINGLE PRODUCT
        app.get('/products/:id', async(req, res)=>{
            const id = req.params.id;
            console.log('getting specific product', id);
            const query = {_id: ObjectId(id)};
            const product = await productsCollection.findOne(query);
            res.json(product);
        })

        // POST API
        app.post('/products', async(req, res)=>{
            const product = req.body;
            console.log('hit the post api', product);
            const result = await productsCollection.insertOne(product);
            console.log(result);
            res.json(result);
        });

        // REMOVE/DELETE API
        app.delete('/products/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await productsCollection.deleteOne(query);
            res.json(result);
        });

        app.get('/users/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
                isAdmin = true;
            }
            res.json({admin: isAdmin});
        });

        app.post('/users', async(req, res)=> {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users/admin',verifyToken, async(req, res)=>{
            const user = req.body;
            const requester = req.decodedEmail;
            if(requester){
                const requesterAcount = await usersCollection.findOne({email: requester});
                if(requesterAcount.role === 'admin'){
                    const filter = {email: user.email};
                    const updateDoc = {$set: {role: 'admin'}};
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else{
                res.status(401).json({message: 'you do not have access to make admin'});
            }
           
        })

    }
    finally{
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/',(req, res) => {
    res.send('Car Sales')
})

app.listen(port, ()=>{
    console.log(`listening at ${port}`)
})