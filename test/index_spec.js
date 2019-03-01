'use strict';

const graphql = require('graphql');
const graphqlFields = require('../index');
const assert = require('assert');

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
                                        userId: { type: graphql.GraphQLString },
                                        first: { type: graphql.GraphQLInt },
                                        includeInactive: { type: graphql.GraphQLBoolean }
                                    },
                                    type: new graphql.GraphQLObjectType({
                                        name: 'UserConnection',
                                        fields: {
                                            pageInfo: {
                                                type: new graphql.GraphQLObjectType({
                                                    name: 'PageInfo',
                                                    fields: {
                                                        totalResults: { type: graphql.GraphQLInt }
                                                    }
                                                })
                                            },
                                            edges: {
                                                type: new graphql.GraphQLList(
                                                    new graphql.GraphQLObjectType({
                                                        name: 'UserEdge',
                                                        fields: {
                                                            cursor: { type: graphql.GraphQLString },
                                                            node: {
                                                                type: new graphql.GraphQLObjectType({
                                                                    name: 'User',
                                                                    fields: {
                                                                        addressBook: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'AddressBook',
                                                                                fields: {
                                                                                    apiType: { type: graphql.GraphQLString }
                                                                                }
                                                                            })
                                                                        },
                                                                        profile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'Profile',
                                                                                fields: {
                                                                                    displayName: { type: graphql.GraphQLString },
                                                                                    email: { type: graphql.GraphQLString }
                                                                                }
                                                                            })
                                                                        },
                                                                        proProfile: {
                                                                            type: new graphql.GraphQLObjectType({
                                                                                name: 'ProProfile',
                                                                                fields: {
                                                                                    apiType: { type: graphql.GraphQLString }
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
    describe('should respect include/skip directives when generating the field map', () => {
      let info = {};
      const schemaString = /* GraphQL*/ `
            type Hobby {
                name: String!
            }
            type Person {
                name: String!
                age: Int!
                hobbies: [Hobby!]
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42,
                };
            },
        };
      it('does not include fields with a false include directive', done => {
        const query = /* GraphQL */ `
            query Query($shouldInclude: Boolean!){
                person {
                    name @include(if: $shouldInclude)
                    age @include(if: false) @skip(if: false)
                    hobbies {
                        name
                    }
                }
            }
        `;
        graphql.graphql(schema, query, root, {}, { ["shouldInclude"]: false })
            .then(() => {
                const expected = {
                    hobbies: {
                      name: {}
                    }
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
      });
      it('does not include fields with a true skip directive', done => {
        const query = /* GraphQL */ `
            query Query($shouldSkip: Boolean!){
                person {
                    name @skip(if: $shouldSkip)
                    age
                    hobbies {
                        name @skip(if: true) @include(if: true)
                    }
                }
            }
        `;
        graphql.graphql(schema, query, root, {}, { ["shouldSkip"]: true })
            .then(() => {
                const expected = {
                    age: {},
                    hobbies: {}
                };
                assert.deepStrictEqual(graphqlFields(info), expected);
                done();
            }).catch(done);
      });
    });
    describe('subfield argument parsing', function () {
        let info = {};
        const schemaString = /* GraphQL*/ `
            type Hobby {
                name: String!
            }
            type Person {
                name (case: String): String!
                age: Int!
                hobbies(first: Int, sort: Boolean, categories: [String]): [Hobby!]
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42
                };
            }
        };

        it('should extract sub-field arguments of Variable type if options is provided', function (done) {
            const variableValues = {
                first: 50
            };

            const query = /* GraphQL */ `
                query Query($first: Int) {
                    person {
                        hobbies(first: $first) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                hobbies: {
                    __arguments: [
                        {
                            first: {
                                kind: 'Variable',
                                value: 50
                            }
                        }
                    ],
                    name: {}
                }
            };

            graphql
                .graphql(schema, query, root, {}, variableValues)
                .then(() => {
                    const fields = graphqlFields(
                        info,
                        {},
                        { processArguments: true }
                    );
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('should extract sub-field arguments of ListValue type if options is provided', function (done) {
            const variableValues = {
                category: 'music'
            };

            const query = /* GraphQL */ `
                query Query($category: String) {
                    person {
                        hobbies(categories: ["sports", $category]) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                hobbies: {
                    __arguments: [
                        {
                            categories: {
                                kind: 'ListValue',
                                value: ['sports', 'music']
                            }
                        }
                    ],
                    name: {}
                }
            };

            graphql
                .graphql(schema, query, root, {}, variableValues)
                .then(error => {
                    const fields = graphqlFields(
                        info,
                        {},
                        { processArguments: true }
                    );
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('should extract sub-field arguments of default type if options is provided', function (done) {
            const query = /* GraphQL */ `
                {
                    person {
                        name(case: "upper")
                        age
                        hobbies(
                            first: 2
                            sort: true
                            categories: ["sports", "music"]
                        ) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                name: {
                    __arguments: [
                        {
                            case: {
                                kind: 'StringValue',
                                value: 'upper'
                            }
                        }
                    ]
                },
                age: {},
                hobbies: {
                    name: {},
                    __arguments: [
                        {
                            first: {
                                kind: 'IntValue',
                                value: '2'
                            }
                        },
                        {
                            sort: {
                                kind: 'BooleanValue',
                                value: true
                            }
                        },
                        {
                            categories: {
                                kind: 'ListValue',
                                value: ['sports', 'music']
                            }
                        }
                    ]
                }
            };
            graphql.graphql(schema, query, root, {}).then(() => {
                const fields = graphqlFields(
                    info,
                    {},
                    { processArguments: true }
                );
                assert.deepStrictEqual(fields, expected);
                done();
            });
        });

        it('should not parse arguments if not specified in options', function (done) {
            const query = /* GraphQL */ `
                {
                    person {
                        name(case: "upper")
                        age
                        hobbies(
                            first: 2
                            sort: true
                            categories: ["sports", "music"]
                        ) {
                            name
                        }
                    }
                }
            `;

            const expected = {
                name: {},
                age: {},
                hobbies: {
                    name: {}
                }
            };
            graphql.graphql(schema, query, root, {}).then(() => {
                const fields = graphqlFields(info);
                assert.deepStrictEqual(fields, expected);
                done();
            });
        });
    });
    describe('excluded fields', function () {
        let info = {};
        const schemaString = /* GraphQL*/ `
            type Person {
                name: String!
                age: Int!
            }
            type Query {
                person: Person!
            }
        `;
        const schema = graphql.buildSchema(schemaString);
        const root = {
            person(args, ctx, i) {
                info = i;
                return {
                    name: 'john doe',
                    age: 42,
                };
            },
        };
        const query = /* GraphQL */ `
            {
                person {
                    name
                    age
                    __typename
                }
            }
        `;
        it('Should exclude fields', function (done) {
            const expected = {
                name: {},
            };
            graphql.graphql(schema, query, root, {})
                .then(() => {
                    const fields = graphqlFields(info, {}, { excludedFields: ['__typename', 'age'] });
                    assert.deepStrictEqual(fields, expected);
                    done();
                });
        });

        it('Should not exclude fields if not specified in options', function (done) {
            const expected = {
                name: {},
                age: {},
                __typename: {},
            };
            graphql.graphql(schema, query, root, {})
                .then(() => {
                    const fields = graphqlFields(info);
                    assert.deepStrictEqual(fields, expected);
                    done();
                })
        });
    });
});
