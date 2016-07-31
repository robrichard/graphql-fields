'use strict';

const graphql = require('graphql');
const parse = require('graphql/language').parse;
const graphqlFields = require('../index');
const assert = require('assert');
const util = require('util');

describe('graphqlFields', () => {
    it('should flatten fragments', function (done) {
        let info = {};
        const schema = new graphql.GraphQLSchema({
            query: new graphql.GraphQLObjectType({
                name: 'Query',
                fields: {
                    viewer: {
                        type: new graphql.GraphQLObjectType({
                            name: 'Viewer',
                            fields: {
                                users: {
                                    args: {
                                        userId: {type: graphql.GraphQLString},
                                        first: {type: graphql.GraphQLInt},
                                        includeInactive: {type: graphql.GraphQLBoolean}
                                    },
                                    type: new graphql.GraphQLObjectType({
                                        name: 'UserConnection',
                                        fields: {
                                            pageInfo: {
                                                type: new graphql.GraphQLObjectType({
                                                    name: 'PageInfo',
                                                    fields: {
                                                        totalResults: {type: graphql.GraphQLInt}
                                                    }
                                                })
                                            },
                                            edges: {
                                                type: new graphql.GraphQLList(
                                                    new graphql.GraphQLObjectType({
                                                        name: 'UserEdge',
                                                        fields: {
                                                            cursor: {type: graphql.GraphQLString},
                                                            node: {
                                                                type: new graphql.GraphQLObjectType({
                                                                    name: 'User',
                                                                    fields: {
                                                                        addressBook: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'AddressBook',
                                                                                fields: {
                                                                                    apiType: {type: graphql.GraphQLString}
                                                                                }
                                                                            })
                                                                        },
                                                                        profile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'Profile',
                                                                                fields: {
                                                                                    displayName: {type: graphql.GraphQLString},
                                                                                    email: {type: graphql.GraphQLString}
                                                                                }
                                                                            })
                                                                        },
                                                                        proProfile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'ProProfile',
                                                                                fields: {
                                                                                    apiType: {type: graphql.GraphQLString}
                                                                                }
                                                                            })
                                                                        }
                                                                    }
                                                                })
                                                            }
                                                        }
                                                    })
                                                )
                                            }
                                        }
                                    })
                                }
                            }
                        }),
                        resolve(root, args, context, i) {
                            info = i;
                            return {};
                        }
                    }
                }
            })
        });


        const query = `
        query UsersRoute {
          viewer {
            users(userId:"123",first:25,includeInactive:true) @skip(if:false) {
              ...A
              ...D
                pageInfo {
                totalResults
              }

            }
          }
        }

        fragment A on UserConnection {
          edges {
            node {
              addressBook {
                apiType
              }
            }
          }
          ...B
        }
        fragment B on UserConnection {
          ...C
          edges {
            cursor
          }
        }

        fragment C on UserConnection {
          edges {
            cursor,
            node {
                profile {
                    displayName,
                    email
                }
            }
          }
        }
        fragment D on UserConnection {
          edges {
            node {
              proProfile {
                apiType
              }
            }
          }
          ...B
        }
        `;


        graphql.graphql(schema, query, null, {})
            .then(() => {
                const expected = {
                    users: {
                        pageInfo: {
                            totalResults: {}
                        },
                        edges: {
                            cursor: {},
                            node: {
                                addressBook: {
                                    apiType: {}
                                },
                                proProfile: {
                                    apiType: {}
                                },
                                profile: {
                                    displayName: {},
                                    email: {}
                                }
                            }
                        }
                    }
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
    });
});
