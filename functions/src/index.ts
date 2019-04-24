import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

export const incrementPosts = functions.database.ref('/posts/{postId}').onCreate(async () => {
    await admin.database().ref('posts').once('value', (allPostsSnapshot) => {
        return admin.database().ref().child('/no-of-posts/').transaction(() => {return allPostsSnapshot.numChildren()})
    })
})

export const onCreateNewComment = functions.database.ref('/comments/{postId}/{commentId}').onCreate(async (commentSnapshot, context) => {
    const postCommentsRef = commentSnapshot.ref.parent
    const promises = []
    if(postCommentsRef === null) {
        return
    }
    // Increment the Comments number
    const incrementPromise = postCommentsRef.once('value', (postCommentsSnapshot) => {
        return admin.database().ref('/posts/').child(context.params.postId).child('/noOfComments/').transaction(() => {return postCommentsSnapshot.numChildren()})
    })
    promises.push(incrementPromise)

    // Save a notification object
    const notification = {
        body: "Someone commented on your post",
        createdAt: (new Date()).getTime()
    }
    const notificationPromise = admin.database().ref('/notifications/').push(notification)
    promises.push(notificationPromise)

    await Promise.all(promises)
})

export const onCreateNewReply = functions.database.ref('/replies/{commentId}/{replyId}').onCreate(async (replySnapshot, context) => {
    const commentRepliesRef = replySnapshot.ref.parent
    const promises = []
    if(commentRepliesRef === null) {
        return
    }
    // Increment the replies number
    const incrementPromise = commentRepliesRef.once('value', (commentRepliesSnapshot) => {
        return admin.database().ref('/comments/').child(replySnapshot.val().postRelatedToId).child(context.params.commentId).child('/noOfReplies/')
                .transaction(() => {return commentRepliesSnapshot.numChildren()})
    })
    promises.push(incrementPromise)

    // Save a notification object
    const notification = {
        body: "Someone replied to your comment",
        createdAt: (new Date()).getTime()
    }
    const notificationPromise = admin.database().ref('/notifications/').push(notification)
    promises.push(notificationPromise)

    await Promise.all(promises)
})