const esClient = require('node-eventstore-client');
const uuid = require('uuid');
const myRL = require("serverline")
const chalk = require('chalk')
const {v4: uuidv4} = require('uuid');

let tcpHost = '0.tcp.ngrok.io:14696'
let httpHost = 'http://5eb3033c29cc.ngrok.io'
let username
let usercolor
let channel = 'main'
let esConnection

const colors = [
    'red',
    'green',
    'blue',
    'magenta',
    'cyan',
    'white',
    'blackBright',
    'redBright',
    'greenBright',
    'yellowBright',
    'blueBright',
    'magentaBright',
    'cyanBright',
]

myRL.init()
changePrompt()

myRL.on('line', function(line) {
    const splitedLine = line.split(' ')
    switch (splitedLine[0]) {
        case '/channels':
            if (1 === splitedLine.length) {
                showChannels()
                break
            } else if (2 === splitedLine.length) {
                channel = splitedLine[1]
                esConnection.close()
                connect()
                changePrompt()
                break
            }
            break
        default:
            createMessage(line)
    }

    if (myRL.isMuted())
        myRL.setMuted(false)
})

function usernameStep() {
    if (!username) {
        myRL.getRL().question(`Your name?:`, function (usernameInput) {
            username = usernameInput
            usercolor = colors[Math.floor(Math.random() * colors.length)];
            console.log(`Welcome ${username}`)
            changePrompt()
        });

    }
}

function changePrompt() {
    let prompt = '> '

    if (username) {
        prompt = chalk[usercolor](username) + ` > `
    }

    if (channel && username) {
        prompt = chalk.yellow(`[${channel}]`) + ' ' + chalk[usercolor](username) + ` > `
    }

    myRL.setPrompt(prompt)
}

function connect() {
    esConnection = esClient.createConnection({}, `tcp://${tcpHost}`)

    esConnection.connect()
    esConnection.once('connected', function (tcpEndPoint) {
        console.log(`Connected to eventstore at ${tcpEndPoint.host}:${tcpEndPoint.port}`)
        usernameStep()
    })
}

connect()

async function getChannels() {
    const userCredentials = await new esClient.UserCredentials('admin', 'changeit');
    const pm = await new esClient.ProjectionsManager(new esClient.NoopLogger(), `http://${httpHost}`, 5000)

    const rawChannels = await pm.getResult('$channels-active', userCredentials)
    return JSON.parse(rawChannels)
}

async function showChannels() {
    const channels = await getChannels()
    console.log('Change channel')
    channels.subChannels.forEach(channel => {
        console.log('/channels ', channel)
    })
    console.log('/channels #channelName# for new channel')
}

esConnection.subscribeToStream(`channel-${channel}`, false, onEvent)
    .catch(error => {
        console.log('error str:', error)
    })

function onEvent(subscription, event) {
    const data = JSON.parse(event.originalEvent.data)
    if (data.hasOwnProperty('message') && data.hasOwnProperty('username')) {
        console.log(chalk[data.usercolor](`[${data.username}]`) + `: ${data.message}`)
    }
}

function createMessage(message) {
    const eventData = {
        message,
        username,
        usercolor
    }
    const event = esClient.createJsonEventData(uuidv4(), eventData, null, 'message')
    esConnection.appendToStream(`channel-${channel}`, esClient.expectedVersion.any, event)
        .catch(error => {
            console.log('Error while attempting to publish message')
        })
}


