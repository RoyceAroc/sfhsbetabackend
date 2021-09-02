const http = require('http');
const path = require("path");
var url = require('url');
const express = require("express");
const app = express();
var cors = require('cors')
const async = require('async');
const fetch = require('node-fetch')
const multer = require('multer');
const port = process.env.PORT || 3000;
const {
    parse
} = require('querystring');
const {
    google,
    datalabeling_v1beta1
} = require('googleapis');
const axios = require('axios');
const {
    promisify
} = require('util');
const creds = require('./client_secret.json');

app.use(cors())
var fs = require('fs');
const { RSA_NO_PADDING } = require('constants');
const { triggerAsyncId } = require('async_hooks');
const { jobs } = require('googleapis/build/src/apis/jobs');

const admin = 'N$nieiu9BN@Nkjsui@JJUhBhUHijJH';

/* Google drive api */
const scopes = [
    'https://www.googleapis.com/auth/drive'
];

const auth = new google.auth.JWT(
    creds.client_email, null,
    creds.private_key, scopes
);

const drive = google.drive({
    version: "v3",
    auth
});
const sheets = google.sheets({
    version: 'v4',
    auth
});

/** Deployment process */
var testing =false; // Set to false if deploying
if(testing) {
    var serverLink = 'http://localhost:3000';
    var redirectLink = 'http://localhost:5501';
} else {
    var serverLink = 'https://sfhsbeta.herokuapp.com';
    var redirectLink = 'https://sfhsbeta.com';
}

/** Deployment process */


/* Google Authentication */
const googleConfig = {
    clientId: '111902926359-qrt4s7bebpvin1st81vpn6rnh1hv5n1o.apps.googleusercontent.com',
    clientSecret: 'cbXn6GVpo88S64PZyy5b-I8-',
    redirect: `${serverLink}/google-auth`
};

const defaultScope = [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];

function createConnection() {
    return new google.auth.OAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirect
    );
}

function getConnectionUrl(auth) {
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: defaultScope
    });
}

function getGooglePlusApi(auth) {
    return google.plus({
        version: 'v1',
        auth
    });
}

function urlGoogle() {
    const auth = createConnection();
    const url = getConnectionUrl(auth);
    console.log(url);
}


async function getAccessTokenFromCode(code) {
    const {
        data
    } = await axios({
        url: `https://oauth2.googleapis.com/token`,
        method: 'post',
        data: {
            client_id: '111902926359-qrt4s7bebpvin1st81vpn6rnh1hv5n1o.apps.googleusercontent.com',
            client_secret: 'cbXn6GVpo88S64PZyy5b-I8-',
            redirect_uri: `${serverLink}/google-auth`,
            grant_type: 'authorization_code',
            code,
        },
    });
    var a = await getGoogleUserInfo(data.access_token);
    return a;
};

async function checkIfCurrentMember(id, name) {
    const request = {
        spreadsheetId: '1SzTrrUvB-viMYahRFTiv1RjJLzP88tvBYMI_5QMabJE',
        ranges: [],
        includeGridData: true,
    };
    try {
        let j=0;
        const response = (await sheets.spreadsheets.get(request)).data;
        let data = JSON.parse(JSON.stringify(response, null, 2));
        for (let i = 0; i < 3; i++) {
            try {
                for (j = 0; j < data.sheets[i].properties.gridProperties.rowCount; j++) {
                    try {
                        let user_id = data.sheets[i].data[0].rowData[j].values[2].formattedValue;
                        if (user_id == id) {
                            return true;
                        } else if(user_id.includes(id)) {
                            let firstName = data.sheets[i].data[0].rowData[j].values[0].formattedValue;
                            let lastName = data.sheets[i].data[0].rowData[j].values[1].formattedValue;
                            if(name.includes(firstName) || name.includes(lastName)) {
                                try {
                                    let sheetID = 0;
                                    if(i==1) {sheetID = 948233976;} else if(i==2){sheedID = 1035860937;}
                                        sheets.spreadsheets.batchUpdate({
                                            spreadsheetId: '1SzTrrUvB-viMYahRFTiv1RjJLzP88tvBYMI_5QMabJE',
                                            resource: {
                                                requests: [
                                                {
                                                    repeatCell: {
                                                    range: {
                                                        "sheetId": sheetID,
                                                        startRowIndex: j,
                                                        startColumnIndex: 2,
                                                        endColumnIndex: 3,
                                                        endRowIndex: j+1
                                                    },
                                                    cell: {
                                                        userEnteredValue: {
                                                            stringValue:id,
                                                        }
                                                    },
                                                    fields: 'userEnteredValue(stringValue)'
                                                    }
                                                },
                                                ]
                                            }
                                        });
                                    } catch(e) {}
                                return true;
                            }
                        }
                    } catch(e) {}    
                }
            } catch (e) {}
        }
        return false;
    } catch (err) {
        return false;
    }
}

async function checkAttendanceStatus(id, num) {
    const request = {
        spreadsheetId: '1SzTrrUvB-viMYahRFTiv1RjJLzP88tvBYMI_5QMabJE',
        ranges: [],
        includeGridData: true,
    };
    try {
        const response = (await sheets.spreadsheets.get(request)).data;
        let data = JSON.parse(JSON.stringify(response, null, 2));
        for (let i = 0; i < 3; ++i) {
            try {
                for (let j = 0; j < data.sheets[i].properties.gridProperties.rowCount; ++j) {
                    let user_id = data.sheets[i].data[0].rowData[j].values[2].userEnteredValue.stringValue;
                    if (user_id == id) {
                        if(data.sheets[i].data[0].rowData[j].values[num].userEnteredFormat.backgroundColor.red == 1 && !data.sheets[i].data[0].rowData[j].values[num].userEnteredFormat.backgroundColor.green) {
                            return true;
                        } else if (data.sheets[i].data[0].rowData[j].values[num].userEnteredFormat.backgroundColor.red == 1 && data.sheets[i].data[0].rowData[j].values[num].userEnteredFormat.backgroundColor.green == 0.6) {   
                            return false;
                        } else {
                            return true;
                        }
                    }
                }
            } catch (e) {}
        }
        return false;
    } catch (err) {
        return false;
    }
}



async function getGoogleUserInfo(access_token) {
    const {
        data
    } = await axios({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        method: 'get',
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });
    if (data.email == "sfhsbeta@gmail.com") {
        return `${redirectLink}/dashboard.html?id=${data.id}&email=${data.email}&name=${data.name}&picture=${data.picture}&admin=${admin}`;
    } else if (data.email.includes("@forsythk12.org") == false) {
        return `${redirectLink}/dashboard.html?error=501`;
    } else if (data.email == undefined) {
        return `${redirectLink}/dashboard.html?error=502`;
    }
    var currentMember = await checkIfCurrentMember(data.email.replace('@forsythk12.org', ''), data.name);
    if (currentMember) {
        return `${redirectLink}/dashboard.html?id=${data.id}&email=${data.email}&name=${data.name}&picture=${data.picture}`;
    } else {
        return `${redirectLink}/dashboard.html?error=503`;
    }
};

app.get('/google-auth', async function(req, res) {
    if (req.query.code != undefined) {
        res.send("<script> window.location.href = \"" + await getAccessTokenFromCode(req.query.code) + "\";</script>");
    }
});

/* Populating Admin Data */
app.post('/admin-data', function(req, res) {
    req.on('data', function(data) {
        if (data == admin) {
            const admin_data = fs.readFileSync('admin_setup.html', 'utf8')
            res.send(admin_data);
        } else {
            res.send(false);
        }
    })
})

/* Populating Member Setup */
app.post('/member-setup', async function(req, res) {
    req.on('data', async function(data) {
        const user_id = data.toString().replace('@forsythk12.org', '');
        // Date template
        var export_data = {
            "attendance": {
                "past_attendance": [],
                "current_attendance": []
            },
            "nonSignatureServiceProjects": []
        };

        sheets.spreadsheets.values.batchGet({
            spreadsheetId: '1RfHIvm90vtwlswODlWyz4rB40Yc9OaXuzIQ9Zo5ao-o',
            ranges: 'Sheet1',
          }, (err, result) => {
            if (err) {
              // Handle error
              console.log(err);
            } else {
                let table = result.data.valueRanges[0].values;
                for(let i=0; i<table.length; i++){
                    if(table[i][0] == user_id) {
                        export_data.nonSignatureServiceProjects.push({
                            "description": table[i][1],
                            "minutes": table[i][2],
                            "relation": table[i][3],
                            "status": table[i][4],
                            "comment": table[i][5]
                        });
                    }
                }
            }
        });

        const meeting_data = JSON.parse(fs.readFileSync('meetings.json', 'utf8'));
        for(let i=0; i<meeting_data.length; i++) {
            if(new Date(meeting_data[i].end) <= new Date()) {
                export_data.attendance.past_attendance.push({
                    "type": meeting_data[i].type,
                    "init": meeting_data[i].init,
                    "questions": meeting_data[i].questions,
                    "completed": await checkAttendanceStatus(user_id, i+3),
                    "start": meeting_data[i].start,
                    "end": meeting_data[i].end,
                    "video_url": meeting_data[i].video_url,
                    "slideshow_url": meeting_data[i].slideshow_url,
                });
            } else if(new Date(meeting_data[i].start) <= new Date()) {
                export_data.attendance.current_attendance.push({
                    "type": meeting_data[i].type,
                    "questions": meeting_data[i].questions,
                    "init": meeting_data[i].init,
                    "completed": await checkAttendanceStatus(user_id, i+3),
                    "start": meeting_data[i].start,
                    "end": meeting_data[i].end,
                    "video_url": meeting_data[i].video_url,
                    "slideshow_url": meeting_data[i].slideshow_url,
                });
            }
        }

        res.send(export_data);
    })
})

function addNonSignatureServiceProjectToSheet(userID, description, hours, minutes, relation) {
    let totalMins = parseInt(hours)*60 + (parseInt(minutes)*15) - 15; 
    sheets.spreadsheets.values.append({
        spreadsheetId: '1RfHIvm90vtwlswODlWyz4rB40Yc9OaXuzIQ9Zo5ao-o',
        range: 'Sheet1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [
            [userID, description, totalMins, relation, "pending"]
          ],
        }
      }, (err, response) => {})
}

try {
    const upload = multer({
        limits: {
          fileSize: 4 * 1024 * 1024, // 4 MB storage
        },
        storage: multer.memoryStorage()
    });
    
    app.post('/submitNonSignatureServiceProject', upload.single('document_file'), async function(req, res) {
        let userID = req.body.userID.toString().replace('@forsythk12.org', '');
        let stream = require('stream');
        let fileObject = req.file;
        let bufferStream = new stream.PassThrough();
        bufferStream.end(fileObject.buffer);
        let semesterFolder = '1ODTr_awNB2GyPHzAScjzdiMrg63ecghl';
        let folderID = "";
        var pageToken = null;
        async.doWhilst(function (callback) {
            drive.files.list({
                q: `'${semesterFolder}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
                fields: 'nextPageToken, files(id, name)',
                spaces: 'drive',
                pageToken: pageToken
            }, function (err, res) {
                if (err) {
                    res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                    callback(err)
                } else {
                    res.data.files.forEach(function (file) {
                        if(file.name == userID) {
                            folderID = file.id;
                        }
                    });
                    pageToken = res.nextPageToken;
                    callback();
                }
            });
        }, function () {
            return !!pageToken;
        }, async function (err) {
            if (err) {
                res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
            } else {
                if(folderID != "") {
                    let libCount = 0;
                    var pageToken = null;
                    async.doWhilst(function (callback) {
                        drive.files.list({
                            q: `'${folderID}' in parents`,
                            fields: 'nextPageToken, files(id, name)',
                            spaces: 'drive',
                            pageToken: pageToken
                        }, function (err, res) {
                            if (err) {
                                res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                            } else {
                                res.data.files.forEach(function (file) {
                                    libCount++;
                                });
                                pageToken = res.nextPageToken;
                                callback();
                            }
                        });
                    }, function () {
                        return !!pageToken;
                    }, function (err) {
                        if (err) {
                            res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                        } else {
                            if(fileObject.mimetype.includes('image')) {
                                var fileMetadata = {
                                    'name': `${libCount+1}.jpg`,
                                    parents: [folderID]
                                };
                                var media = {
                                    mimeType: fileObject.mimetype,
                                    body: bufferStream
                                };
                                drive.files.create({
                                    resource: fileMetadata,
                                    media: media,
                                    fields: 'id'
                                }, function (err, file) {
                                    if (err) {
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                                    } else {
                                        addNonSignatureServiceProjectToSheet(userID, req.body.description, req.body.hours, req.body.minutes, file.data.id);
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html` + "\";</script>");
                                    }
                                });
                            } else if(fileObject.mimetype == "application/pdf") {
                                var fileMetadata = {
                                    'name': `${libCount+1}.pdf`,
                                    parents: [folderID]
                                };
                                var media = {
                                    mimeType: fileObject.mimetype,
                                    body: bufferStream
                                };
                                drive.files.create({
                                    resource: fileMetadata,
                                    media: media,
                                    fields: 'id'
                                }, function (err, file) {
                                    if (err) {
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                                    } else {
                                        addNonSignatureServiceProjectToSheet(userID, req.body.description, req.body.hours, req.body.minutes, file.data.id);
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html` + "\";</script>");
                                    }
                                });
                            }
                        }
                    })
                } else {
                    // Folder for user hasn't been created yet
                    var fileMetadata = {
                        'name': userID,
                        parents: [semesterFolder],
                        'mimeType': 'application/vnd.google-apps.folder'
                      };
                      drive.files.create({
                        resource: fileMetadata,
                        fields: 'id'
                      }, async function (err, file) {
                        if (err) {
                            res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                        } else {
                            if(fileObject.mimetype.includes('image')) {
                                var fileMetadata = {
                                    'name': `1.jpg`,
                                    parents: [file.data.id]
                                };
                                var media = {
                                    mimeType: fileObject.mimetype,
                                    body: bufferStream
                                };
                                drive.files.create({
                                    resource: fileMetadata,
                                    media: media,
                                    fields: 'id'
                                }, function (err, file) {
                                    if (err) {
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                                    } else {
                                        addNonSignatureServiceProjectToSheet(userID, req.body.description, req.body.hours, req.body.minutes, file.data.id);
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html` + "\";</script>");
                                    }
                                });
                            } else if(fileObject.mimetype == "application/pdf") {
                                var fileMetadata = {
                                    'name': `1.pdf`,
                                    parents: [file.data.id]
                                };
                                var media = {
                                    mimeType: fileObject.mimetype,
                                    body: bufferStream
                                };
                                drive.files.create({
                                    resource: fileMetadata,
                                    media: media,
                                    fields: 'id'
                                }, function (err, file) {
                                    if (err) {
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");
                                    } else {
                                        addNonSignatureServiceProjectToSheet(userID, req.body.description, req.body.hours, req.body.minutes, file.data.id);
                                        res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html` + "\";</script>");
                                    }
                                });
                            }
                        }
                    });
                }
            }
        })
    }); 
} catch(e) {res.send("<script> window.location.href = \"" + `${redirectLink}/dashboard.html?error=504` + "\";</script>");}


/* Uptime robot configuration */
app.get('*', function(req, res) {
    fs.readFile('index.html', function(err, data) {
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.write(data);
        return res.end();
    });
});



app.listen(port, () => {});



app.post('/checkAttendanceForMonth', async function(req, res) {
    req.on('data', async function (data) {
			var obj = JSON.parse(data);
    let uid = obj.userID.toString().replace('@forsythk12.org', '');
    let present = obj.present;
    let init = obj.init;
    let spreadsheetId = "1SzTrrUvB-viMYahRFTiv1RjJLzP88tvBYMI_5QMabJE";  
    const request = {
        spreadsheetId: "1SzTrrUvB-viMYahRFTiv1RjJLzP88tvBYMI_5QMabJE",
        ranges: [],
        includeGridData: true,
    };
    let subsheet = "0";
    try {
        const response = (await sheets.spreadsheets.get(request)).data;
        let data = JSON.parse(JSON.stringify(response, null, 2));
        for (let i = 0; i < 3; ++i) {
            try {
                for (let j = 0; j < data.sheets[i].properties.gridProperties.rowCount; ++j) {
                    let user_id = data.sheets[i].data[0].rowData[j].values[2].userEnteredValue.stringValue;
                    if (user_id == uid) {
                        if(i == 0) {
                            subsheet = "0";
                        } else if(i==1) {
                            subsheet = "948233976";
                        } else {
                            subsheet = "1035860937"
                        }   
                        if(present) {
                            batchUpdateRequest = {
                                "requests": [
                                    {
                                        "updateCells": {
                                        "range": {
                                            "sheetId": subsheet,
                                            "startRowIndex": j,
                                            "endRowIndex": j+1,
                                            "startColumnIndex": init+3,
                                            "endColumnIndex": init+4
                                        },
                                        "rows": [
                                            {
                                            "values": [
                                                {
                                                "userEnteredFormat": {
                                                    "backgroundColor": {
                                                    "green": 1
                                                    }
                                                }
                                                }
                                            ]
                                            }
                                        ],
                                        "fields": "userEnteredFormat.backgroundColor"
                                        }
                                    }
                                ]
                            };
                        } else {
                            batchUpdateRequest = {
                                "requests": [
                                    {
                                        "updateCells": {
                                        "range": {
                                            "sheetId": subsheet,
                                            "startRowIndex": j,
                                            "endRowIndex": j+1,
                                            "startColumnIndex": init+3,
                                            "endColumnIndex": init+4
                                        },
                                        "rows": [
                                            {
                                            "values": [
                                                {
                                                "userEnteredFormat": {
                                                    "backgroundColor": {
                                                    "red": 1
                                                    }
                                                }
                                                }
                                            ]
                                            }
                                        ],
                                        "fields": "userEnteredFormat.backgroundColor"
                                        }
                                    }
                                ]
                            };
                        }
                        
                        sheets.spreadsheets.batchUpdate({
                            spreadsheetId,
                            resource: batchUpdateRequest
                            }, (err, response) => {
                            if (err) {
                                res.send("Error");
                            } else {
                                res.send("Done");
                            }
                        });
                    }
                }
            } catch (e) {}
        }
        return false;
    } catch (err) {
        return false;
    }
    });
});