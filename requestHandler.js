var util = require('util'),
    colors = require('colors'),
    PF = require('pathfinding'),
    fs = require('fs'),
    config = {
        ingameConfigPath : __dirname + '/ingame.json',
        types : ['hero','enemy','gold','bomb', 'dead', 'enemyHero'],
        command : {
            up : 'UP',
            down : 'DOWN',
            left : 'LEFT',
            right : 'RIGHT'
        },
        ingame : {
            enemies : {
                detect : true,
                stepsToDetect : 5
            },
            aggresion : {
                closeToEnemy : true,
                agony : true,
                always : false
            },
            agony : {
                timeout : 5,
                aggresionTimeout : 5
            },
            visualizator : {
                showRaw : false
            }
        }
    },
    storage = {
        currentTurn : 0,
        agonyTurn : 0,
        bombTimer : 0,
        currentPath : []
    },
    finder = new PF.BestFirstFinder({
        heuristic : PF.Heuristic.euclidean,
        allowDiagonal: false
    })

// AStarFinder *
// BreadthFirstFinder *
// BestFirstFinder
// DijkstraFinder *
// BiAStarFinder
// BiBestFirstFinder
// BiDijkstraFinder *
// BiBreadthFirstFinder *
// JumpPointFinder *

var requestHandler = function(connection, data){
    turnUpdater();
    storage.map = buildMap(data);
    vizualizeMap(storage.map);
    var command = think();
    
    var result = [command];

    if (config.ingame.aggresion.enabled || config.ingame.aggresion.always) {
        result.unshift('ACT')
    }

    console.log(result);

    // console.log('Argessive mod: ' + (config.ingame.aggresion.always?config.ingame.aggresion.always.toString().rainbow:config.ingame.aggresion.always));

    //console.log('Current command: ' + command);
    connection.sendUTF(result.join(','));
}

function buildMap(data) {
    var mapString = data.split('board=')[1],
        mapSize = (storage.mapSize ? storage.mapSize : Math.sqrt(mapString.length)),
        map = [],
        matrix = [],
        buffer = '',
        matrixBuffer = [];

    !storage.mapSize ? storage.mapSize = mapSize : null ;

    for (var i = 0; i < config.types.length; i++) {
        if (typeof storage[config.types[i]] != 'undefined') {
            storage['lastDataOf' + config.types[i]] = storage[config.types[i]];
        }
        storage[config.types[i]] = [];
    };

    for (var i = 0; i < mapString.length; i++) {
        var charData = checkCharacter(mapString[i]);
        matrixBuffer.push(charData.value);
        buffer += charData.sign;
        if (i != 0 && i % mapSize == mapSize - 1) {
            map.push(buffer);
            matrix.push(matrixBuffer);
            buffer = '';
            matrixBuffer = [];
        }

        if (charData.savePosition) {
            var currentPosition = [matrix.length, matrixBuffer.length - 1];
            storage[charData.name].push(currentPosition);
            charData.showInConsole ? console.log(charData.name + ' position:' + storage[charData.name]) : null;
        }
    };

    for (var i = 0; i < config.types.length; i++) {
        if (storage[config.types[i]].length == 1) {
            storage[config.types[i]] = storage[config.types[i]][0]
        }
    };

    return {string : map, matrix : matrix}
}

function turnUpdater(){
    storage.matrix = null;
    storage.blockedSteps = [];
    updateConfig();
    util.print("\u001b[2J\u001b[0;0H");
    storage.currentTurn++;
    //console.log('Current turn: '+ storage.currentTurn);
}

function checkCharacter(character){
    var value = 0,
        showInConsole = false,
        savePosition = false,
        name = new String,
        update = false;
    switch (character) {
        case '☺': // our character
            name = 'hero';
            character = character.green;
            savePosition = true;
            break
        case '♥': //enemy character
            name = 'enemyHero';
            character = character.red;
            savePosition = true;
            // value = config.ingame.enemies.detect ? 0 : 1;
            value = 1;
            break
        case 'X': //dead character
            name = 'dead';
            character = character.red;
            savePosition = true;
            break
        case '&':
            name = 'enemy';
            character = character.red;
            savePosition = true;
            // value = config.ingame.enemies.detect ? 0 : 1;
            value = 1;
            break
        case 'x' || '1' || '2' || '3' || '4' || '5': //bomb
            name = 'bomb'; 
            character = character.red;
            savePosition = true;
            value = 1;
        case '☼': //wall
            character = character.cyan;
            value = 1;
            break
        case '#': //wall
            character = character.cyan;
            value = 1;
            break
    }

    return {sign : character, value : value, savePosition : savePosition, name : name, showInConsole : showInConsole}
}

function vizualizeMap(map) {
    var mapObject = new Array;
    !config.ingame.visualizator.showRaw ? mapObject = map.string : mapObject = map.matrix;
    for (var i = 0; i < mapObject.length; i++) {
        console.log(mapObject[i]);
    };
}

function think() {
    if (storage.dead && storage.dead.length > 0 || storage.hero.length == 0) {
        console.log('Hero died :('.red);
        command = generateCommand('random');
        storage.bombTimer = 0;
        storage.currentPath = [];
    } else {
        
        var command = new String,
            hero = storage.hero || storage.lastDataOfhero,
            bestPath;

            var closestEnemy = getClosest('enemyHero'),
                matrix = getMatrix();

                matrix.setWalkableAt(closestEnemy[0], closestEnemy[1], true);

        if (closestEnemy[2] == Infinity) {
            config.ingame.aggresion.enabled = true;
            return
        }

        // console.log('Hero: ' + hero);
        // console.log(storage.currentPath);

        storage.findingEnemy = true;

        if (storage.findingEnemy) {
            bestPath = storage.currentPath;

            if (storage.bombTimer) {
                config.ingame.aggresion.enabled = false;
                storage.bombTimer--;

                console.log("decreasing timer");

            }
            
            if (bestPath.length == 0) {                
                if (closestEnemy.length > 0) {
                    bestPath = finder.findPath(hero[0], hero[1], closestEnemy[0], closestEnemy[1], matrix);
                    bestPath.pop();
                    console.log("closest enemy:" + closestEnemy);
                }
            }

            if (bestPath.length == 1) {

                if (storage.bombDropped) {

                    if (!storage.bombTimer) {                        
                        if (closestEnemy.length > 0) {                            
                            bestPath = finder.findPath(hero[0], hero[1], closestEnemy[0], closestEnemy[1], matrix);
                            bestPath.pop();

                            console.log("setting path to enemy:" + bestPath);
                        }

                        storage.bombDropped = false;
                    } else {
                        console.log("timer exists");
                    }

                } else {
                    console.log("dropping bomb");

                    config.ingame.aggresion.enabled = true;
                    storage.bombTimer = 5;
                    bestPath = lookAround(hero);
                    storage.bombDropped = true;
                }
            } else {
                //checking bombs on route

                for (var i = 1; i < 3; i++) {
                    if (bestPath[i] && !isWalkable(bestPath[i])) {
                        if (closestEnemy.length > 0) {
                            console.log('!!! ---------- Generating new path/dropping bomb cose of danger');

                            config.ingame.aggresion.enabled = true;
                            storage.bombTimer = 5;
                            bestPath = lookAround(hero);
                            storage.bombDropped = true;
                        }

                    }
                };
            }        
        } else {            
            if (storage.bombTimer) {
                config.ingame.aggresion.enabled = false;
                storage.bombTimer--;
                bestPath = storage.currentPath;
            } else {
                bestPath = lookAround(hero);
                if (bestPath.length == 1) {
                    config.ingame.aggresion.enabled = true;
                    storage.bombTimer = 5;
                }            
            }
        }

        if (bestPath.length > 1) {
            command = generateCommand(bestPath[1]);
            bestPath.shift();
            storage.currentPath = bestPath;
        }      

    }

    return command;
}

function isWalkable(coords) {
    var grid = storage.map.matrix;
        if (grid[coords[0]][coords[1]] == 0) {
            return true;
        } else {
            return false;
        }
}

function lookAround(hero) {
    var points = [],
        point = hero.slice(0),
        multiplier = Math.round(Math.random()) * 2 - 1,
        path;

    // console.log('hero:' + hero);

    (function() {
        for (var step = 1; step < 6; step++) {
            for (var i = 1; i < step; i++) {
                point[0] = point[0] + multiplier;
                if (checkPoint(point))
                    return
            };
            
            for (var i = 1; i < step; i++) {
                point[1] = point[1] + multiplier;
                checkPoint(point);
                if (checkPoint(point))
                    return
            };
            multiplier =- multiplier;
        };
    })();

    function checkPoint(point){
        if (safePoint(point)) {
            var matrix = getMatrix();

            path = finder.findPath(hero[0],hero[1],point[0],point[1],matrix);

            if (path.length > 0) {
                return true;
            } else {
                return false;
            }
            
        } else {
            return false;
        }
    };

    function safePoint(point){
        var result = point[0] != hero[0] && point[1] != hero[1];
        for (var i = 0; i < point.length; i++) {
            if (point[i] < 0 || point[i] >= storage.mapSize){
                result = false;
            }
        };
        return result;
    }

    return path;
}

function generateCommand(point) {
    var command = new String,
        hero = storage.hero || storage.lastDataOfhero;
    if (typeof point == 'string') {
        var list = [];
        for (i in config.command) {
            list.push(config.command[i]);
        }
        var randomNumber = Math.floor(Math.random() * (list.length - 1 + 1));
        storage.agonyTurn++;
        if (storage.agonyTurn >= (config.ingame.agony.aggresionTimeout - 1)) {
            config.ingame.aggresion.enabled = config.ingame.aggresion.agony;
        }
        command = list[randomNumber];
    } else {
        if (hero[0] > point[0]) {
            command = config.command.up
        } else if (hero[0] < point[0]) {
            command = config.command.down
        } else if (hero[1] < point[1]) {
            command = config.command.right
        } else if (hero[1] > point[1]) {
            command = config.command.left
        } else {
            command = generateCommand('random')
        }
    }

    if (storage.blockedSteps[command]) {
        command = generateCommand('random');
    } else {
        var nextStep = hero;

        switch (command) {
            case 'LEFT':
                nextStep[1]--
                break
            case 'RIGHT':
                nextStep[1]++
                break
            case 'UP':
                nextStep[0]--
                break
            case 'DOWN':
                nextStep[0]++
                break
        }

        try {if (nextStep[0] < 0 || nextStep[1] < 0 || storage.map.matrix[nextStep[0]][nextStep[1]] == 1) {
            storage.blockedSteps.push(command);
            command = generateCommand('random');
        }} catch(e){}
    }

    return command
} 

function getClosest(itemName){
    var closestIndex = 0,
        closestValue = Infinity,
        hero = storage.hero || storage.lastDataOfhero;

        for (var i = 0; i < storage[itemName].length; i++) {
            var grid = getMatrix();

            if(itemName == 'enemy' || itemName == 'enemyHero') {
                grid.setWalkableAt(storage[itemName][i][0], storage[itemName][i][1], true);
            }

            // var path = finder.findPath(hero[0], hero[1], storage[itemName][i][0], storage[itemName][i][1], grid),
            var path = finder.findPath(hero[0], hero[1], storage[itemName][i][0], storage[itemName][i][1], grid),
                result = Infinity;

            if (path.length > 0) {
                result = path.length;
            }

            storage[itemName][i][2] = result;
        };

        for (var i = 0; i < storage[itemName].length; i++) {
            var pathToPointLength = storage[itemName][i][2];
                if (pathToPointLength < closestValue && pathToPointLength != 0) {
                    closestValue = pathToPointLength;
                    closestIndex = i;
                }
        };

    var result = storage[itemName][closestIndex];

    console.log("Current target:" + storage[itemName][closestIndex]);

    return storage[itemName][closestIndex]
}

function getMatrix(){
    if (!storage.matrix) {
        storage.matrix = new PF.Grid(storage.mapSize, storage.mapSize);

        for (var i = 0; i < storage.map.matrix.length; i++) {
            var line = storage.map.matrix[i];
            for (var j = 0; j < line.length; j++) {
                if (line[j] == 1) {
                    storage.matrix.setWalkableAt(i, j, false)
                }
            };
        };
    } 
    
    return storage.matrix.clone();
}

function updateConfig() {
    fs.readFile(config.ingameConfigPath, 'utf8', function (err, data) {
      if (err) {
        console.log('Error retrieving ingame config: ' + err);
        return;
      }
     
      config.ingame = JSON.parse(data);
    });
}

module.exports = requestHandler;