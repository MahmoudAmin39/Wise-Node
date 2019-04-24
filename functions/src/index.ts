import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

export const addAuthUserToDatabase = functions.auth.user().onCreate((user, context) => {
    const newUser = {
        name: user.displayName,
        email: user.email,
        id: user.uid,
        profilePhotoUrl: user.photoURL
    }
    return admin.database().ref('/users/').child(user.uid).set(newUser)
})

export const incrementPosts = functions.database.ref('/posts/{postId}').onCreate(async () => {
    await admin.database().ref().child('/no_of_posts/').transaction((currentCount) => {return currentCount + 1})
})

export const incrementUsers = functions.database.ref('/users/{userId}').onCreate(async () => {
    await admin.database().ref().child('/no_of_users/').transaction((currentCount) => {return currentCount + 1})
})

export const onCreateNewComment = functions.database.ref('/comments/{postId}/{commentId}').onCreate(async (commentSnapshot, context) => {
    const postCommentsRef = commentSnapshot.ref.parent
    const promises = []
    if(postCommentsRef === null) {
        return
    }
    // Increment the Comments number
    const incrementPromise = admin.database().ref('/posts/')
                                            .child(context.params.postId)
                                            .child('/no_of_comments/')
                                            .transaction((currentCount) => {return currentCount + 1})
    promises.push(incrementPromise)

    // Save a notification object to the Post owner
    if(!commentSnapshot.val().is_self_feedback) {
        admin.database().ref('/posts/').child(context.params.postId).once('value', (postSnapshot) => {
            const post = postSnapshot.val()
            const notification = {
                owner_id: post.creator_id,
                type: 'COMMENT_TO_POST',
                redirect_to_post_id: post.id,
                body: post.no_of_comments === 1 ? "Someone commented on your post." : "Many people commented on your post.",
                createdAt: (new Date()).getTime()
            }
            const notificationPromise = admin.database().ref('/notifications/').child(post.creator_id).child(post.id).set(notification)
            promises.push(notificationPromise)
        }).catch(error => {console.log(error.toJson())})
    }

    // Save a notification object to other people commented on the post
    postCommentsRef.once('value', (postCommentsSnapshot) => {
        if(postCommentsSnapshot.hasChildren()) {
            postCommentsSnapshot.forEach(postCommentSnapshot => {
                const comment = postCommentSnapshot.val()
                if(!commentSnapshot.val().is_self_feedback && !(commentSnapshot.val().id === comment.id)) {
                    const notification = {
                        owner_id: comment.creator_id,
                        type: 'COMMENT_TO_POST',
                        redirect_to_post_id: comment.related_post_id,
                        body: "Someone commented on a post you already commented on.",
                        createdAt: (new Date()).getTime()
                    }
                    const notificationPromise = admin.database().ref('/notifications/').child(comment.creator_id).child(comment.related_post_id).set(notification)
                    promises.push(notificationPromise)
                }
            });
        }
    }).catch(error => {console.log(error.toJson())})

    await Promise.all(promises)
})

export const onCreateNewReply = functions.database.ref('/replies/{commentId}/{replyId}').onCreate(async (replySnapshot, context) => {
    const commentRepliesRef = replySnapshot.ref.parent
    const promises = []
    if(commentRepliesRef === null) {
        return
    }
    // Increment the replies number
    const incrementPromise = admin.database().ref('/comments/')
                                            .child(replySnapshot.val().related_post_id)
                                            .child(context.params.commentId)
                                            .child('/no_of_replies/')
                                            .transaction((currentCount) => {return currentCount + 1})
    promises.push(incrementPromise)

    // Save a notification object to the Comment owner
    if(!replySnapshot.val().is_self_feedback) {
        admin.database().ref('/comments/').child(context.params.commentId).once('value', (commentSnapshot) => {
            const comment = commentSnapshot.val()
            const notification = {
                type: 'REPLY_TO_COMMENT',
                redirect_to_post_id: comment.id,
                owner_id: comment.creator_id,
                body: comment.no_of_replies === 1 ? "Someone replied to your comment." : "Many people replied to your comment.",
                createdAt: (new Date()).getTime()
            }
            const notificationPromise = admin.database().ref('/notifications/').child(comment.creator_id).child(comment.id).set(notification)
            promises.push(notificationPromise)
        }).catch(error => {console.log(error.toJson())})
    }

    // Save a notification object to other people replied to the comment
    commentRepliesRef.once('value', (commentRepliesSnapshot) => {
        if(commentRepliesSnapshot.hasChildren()) {
            commentRepliesSnapshot.forEach(commentReplySnapshot => {
                const reply = commentReplySnapshot.val()
                if(!replySnapshot.val().is_self_feedback && !(replySnapshot.val().id === reply.id)) {
                    const notification = {
                        owner_id: reply.creator_id,
                        type: 'REPLY_TO_COMMENT',
                        redirect_to_post_id: reply.related_comment_id,
                        body: "Someone replied to a comment you already replied to.",
                        createdAt: (new Date()).getTime()
                    }
                    const notificationPromise = admin.database().ref('/notifications/').child(reply.creator_id).child(reply.related_comment_id).set(notification)
                    promises.push(notificationPromise)
                }
            });
        }
    }).catch(error => {console.log(error.toJson())})

    await Promise.all(promises)
})