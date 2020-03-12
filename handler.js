'use strict';
const AWS = require('aws-sdk');
const uuid = require('uuid/v4');

const db = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10'});

const postsTable = process.env.POSTS_TABLE;

//eine antwort erstellen
function response(statusCode, message) {
    return{
        statusCode: statusCode,
        body: JSON.stringify(message)
    }
}

//sort by date für die auflistung von allen Posts bzw der Pagination-funktion (getPosts/{number})
function sortByDate(a,b){
    if(a.createdAt > b.createdAt)
        return -1;
    else
        return 1;
}

//create a post
module.exports.createPost = (event, context, callback) => {
    const reqBody = JSON.parse(event.body);

    //simple validation
    if(!reqBody.title || reqBody.title.trim() === '' || !reqBody.body || reqBody.body.trim() === '' ){
        return callback(null, response(400, {error: "Post muss einen Titel und einen Body haben"}))
    }

    const post = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        userId: 1, //ToDo: yo
        title: reqBody.title,
        body: reqBody.body
    };

    return db.put({
        TableName: postsTable,
        Item: post
    }).promise().then(() => {
        callback(null, response(201, post)) //null weil keine fehler
    }).catch(err => {
        response(null, response(err.statusCode, err));
    })
}

//get all posts
module.exports.getAllPosts = (event, context, callback) => {
    return db.scan({
        TableName: postsTable,
    }).promise().then(res => {
        console.log('LOGGME', res.Items);
        callback(null, response(200, res.Items.sort(sortByDate)))
    }).catch(err => {
        callback(null, response(err.statusCode, err));
    })
}

//get specific number of posts
module.exports.getPosts = (event, context, callback) => {
    const numberOfPosts = event.pathParameters.number;
    const params = {
        TableName: postsTable,
        Limit: numberOfPosts
    };
    return db.scan(params).promise().then(res => {
        callback(null, response(200, res.Items.sort(sortByDate)))
    }).catch(err => {
        callback(null, response(err.statusCode, err));
    })
}

//get a single post
module.exports.getPost = (event, context, callback) => {
    const id = event.pathParameters.id;
    const param = {
        Key:{
            id: id
        },
        TableName: postsTable
    }
    return db.get(param).promise().then(res => {
        if(res.Item) callback(null, response(200, res.Item))
        else callback(null, response(404, { error: "Post konnte nicht gefunden werden"}))
    }).catch(err => {
        callback(null, response(err.statusCode, err));
    })
}

//update a post -> dynamodb allows only update one field at a time
module.exports.updatePost = (event, context, callback) => {
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body);
    const paramName = body.paramName;
    const paramValue = body.paramValue;

    const params = {
        Key:{
            id: id
        },
        TableName: postsTable,
        ConditionExpression: 'attribute_exists(id)', //kondition die gegeben sein muss damit das update durchgeführt wird
        UpdateExpression: 'set ' + paramName + ' = :v', //ausdruck der definiert welche attribute geändert werden, action performed auf ihnen , und new values
        ExpressionAttributeValues : { //werte welche in updatexpression referenziert werden
            ':v': paramValue
        },
        ReturnValues: 'ALL_NEW' //was returnen wir - bevor oder nachdem geupdatet wurde.. ALL_NEW=> ALL_NEW - Returns all of the attributes of the item, as they appear after the UpdateItem operation.
    };

    return db.update(params).promise().then(res => {
        console.log('RES',res);
        callback(null, response(200, res))
    }).catch(err => {
        callback(null, response(err.statusCode, err))
    });
}

//delete a post
module.exports.deletePost = (event, context, callback) => {
    const id = event.pathParameters.id;
    const params = {
        Key:{
            id: id
        },
        TableName: postsTable
    };

    return db.delete(params).promise().then(res => {
        callback(null, response(200, {message: "Post wurde erfolgreich gelöscht!"}))
    }).catch(err => {
        callback(null, response(err.statusCode, err))
    })
}
