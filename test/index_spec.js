'use strict';

const parse = require('graphql/language').parse;
const graphqlFields = require('../index');
const assert = require('assert');
const util = require('util');

describe('graphqlFields', () => {
    it('should flatten fragments', () => {
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

        const doc = parse(query);
        const usersAST = doc.definitions[0].selectionSet.selections[0];
        const info = {
            fieldASTs: [usersAST],
            fragments: {
                'A': doc.definitions[1],
                'B': doc.definitions[2],
                'C': doc.definitions[3],
                'd': doc.definitions[34]
            }
        };

        const actual = graphqlFields(info);
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
                        profile: {
                            displayName: {},
                            email: {}
                        }
                    }
                }
            }
        };

        assert.deepStrictEqual(actual, expected, `
actual:
${util.inspect(actual, {depth: null})},

expected:
${util.inspect(expected, {depth: null})}
        `);
    })
});
