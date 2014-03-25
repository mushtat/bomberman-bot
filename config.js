var config = {
    user : 'test',
    server : 'ws://tetrisj.jvmhost.net:12270/codenjoy-contest/ws?user=',
    getPath : function() {
        return this.server + this.user
    }
}

module.exports = config;