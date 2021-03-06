/*
 * Copyright 2013 Jive Software
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

exports.tileEventNames = {
    'PUSH_DATA_TO_JIVE':'pushDataToJive',
    'PUSH_ACTIVITY_TO_JIVE':'pushActivityToJive',
    'PUSH_COMMENT_TO_JIVE':'pushCommentToJive',
    'COMMENT_ON_ACTIVITY':'commentOnActivity',
    'COMMENT_ON_ACTIVITY_BY_EXTERNAL_ID':'commentOnActivityByExternalID',
    'FETCH_COMMENTS_ON_ACTIVITY':'fetchCommentsOnActivity',
    'FETCH_ALL_COMMENTS_FOR_EXT_STREAM':'fetchAllCommentsForExtstream',
    'INSTANCE_REGISTRATION':'registration',
    'INSTANCE_UNREGISTRATION':'unregistration',
    'CLIENT_APP_REGISTRATION':'clientAppRegistration',
    'GET_PAGINATED_RESULTS':'getPaginatedResults',
    'GET_EXTERNAL_PROPS':'getExternalProps',
    'SET_EXTERNAL_PROPS':'setExternalProps',
    'DELETE_EXTERNAL_PROPS':'deleteExternalProps'
};

exports.globalEventNames = {
    'NEW_INSTANCE':'newInstance',
    'INSTANCE_UPDATED':'updateInstance',
    'INSTANCE_REMOVED':'destroyedInstance',
    'DATA_PUSHED':'dataPushed',
    'ACTIVITY_PUSHED':'activityPushed',
    'COMMENT_PUSHED':'commentPushed'
}

exports.roles = {
    'WORKER':'worker',
    'PUSHER':'pusher',
    'HTTP_HANDLER':'http'
}