const axios = require("axios");
const express = require("express");
const { Base64 } = require("js-base64");
const PORT = process.env.PORT | 8080;
const username = "user_dshb";
const password = "S7ZUAFMncz";
var fs = require("fs");

const URI_Root =
  "https://wsg.ings.sk/ws/v2.5/repositories/Bentley.PW--pwdi.ings.sk~3APW_INGS_DEMO23/";

const app = express();
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(express.static("public"));

const getUniversal = (url, req, res, qry) => {
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Basic " + Base64.encode(`${username}:${password}`)
    },
  });
  axiosInstance
    .get(url)
    .then((response) => {
      if (qry) {
        if (qry == "addr") {
          res.send(
            response.data.instances.filter(
              (f) => f.properties.IsConnectedProject == true
            )
          );
        }
      }
      res.send(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

app.get("/qry", (req, res) => {
  const instanceId = req.query.instanceId;
  if (!instanceId) {
    res.send("Please provide instanceId");
    return;
  }
  const url = URI_Root + `Navigation/NavNode/${instanceId}/NavNode`;
  getUniversal(url, req, res);
});

app.get("/DocumentInfo", (req, res) => {
  const Key_InstanceId = req.query.Key_InstanceId;
  if (!Key_InstanceId) {
    res.send("Please provide instanceId");
    return;
  }
  let url = URI_Root + "PW_WSG/Document/" + Key_InstanceId;
  getUniversal(url, req, res);
});
app.get("/FldInfo", (req, res) => {
  const Key_InstanceId = req.query.Key_InstanceId;
  if (!Key_InstanceId) {
    res.send("Please provide instanceId");
    return;
  }
  let url = URI_Root + "PW_WSG/Project/" + Key_InstanceId;
  getUniversal(url, req, res);
});
app.get("/classes", (req, res) => {
  const q =
    "MetaSchema/ECClassDef?$filter=SchemaHasClass-backward-ECSchemaDef.Name+in+['PW_WSG']";
  let url = URI_Root + q;
  getUniversal(url, req, res);
});

app.get("/navNode", (req, res) => {
  const url = URI_Root + "Navigation/NavNode";
  getUniversal(url, req, res);
});

// zoznamm adresarov
app.get("/addr", (req, res) => {
  const url = URI_Root + "PW_WSG/Project";
  getUniversal(url, req, res, "addr");
});
// projekt na zaklade
app.get("/proj", (req, res) => {
  const url = URI_Root + "PW_WSG/Project?$filter=IsConnectedProject eq true";
  getUniversal(url, req, res);
});

app.get("/aggregate", async (req, res) => {
  try {
    const urls = [
      URI_Root + "PW_WSG_Dynamic/PrType_1028_BIMPROJEKTSZ",
      URI_Root + "PW_WSG/Project?$filter=IsConnectedProject eq true",
    ];
    const axiosInstance = axios.create({
      headers: {
        "Access-Control-Allow-Origin": "*",
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Basic " + Base64.encode(`${username}:${password}`)
      },
    });
    const requests = urls.map((url) =>
      axiosInstance.get(url,)
    );
    const responses = await Promise.all(requests);

    const aggregatedData = responses.map((response) => response.data);

    res.json(aggregatedData);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


async function getIssues(token, urls) {
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const requests = urls.map((url) => axiosInstance.get(url));
  try {
    const results = await Promise.allSettled(requests);
    const validResponses = results
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return { url: urls[index], data: result.value.data };
        }
        return null;
      })
      .filter((response) => response !== null);
    return validResponses;
  } catch (error) {
    console.log(error);
  }
}
async function getIssueDetail(token, urls) {
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const requests = urls.map((url) => axiosInstance.get(url));
  try {
    const results = await Promise.allSettled(requests);
    const validResponses = results
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return { url: urls[index], data: result.value.data };
        }
        return null;
      })
      .filter((response) => response !== null);
    return validResponses;
  } catch (error) {
    console.log(error); // handle error here
  }
}
async function getIssueDetails(token, details) {
  const issueDetails = [];
  for (let i = 0; i < details.length; i++) {
    const dt = details[i];
    try {
      const detail = await getIssueDetail(token, dt.urls);
      detail.forEach((e) => {
        const id = e.url.replace("https://api.bentley.com/issues/", "");
        e.id = id;
        delete e.url;
      });
      issueDetails.push({ id: dt.id, data: detail });
    } catch (error) {
      console.log(error);
    }
  }

  return issueDetails;
}

app.get("/issuesLive", async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.send(res.status(400).send("Token is required"));
    return;
  }
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Basic " + Base64.encode(`${username}:${password}`)
    },
  });
  const urlConnProjects =
    URI_Root + "PW_WSG/Project?$filter=IsConnectedProject eq true";
  axiosInstance.get(urlConnProjects).then((response) => {
    const instances = response.data.instances;
    const uris = [];
    instances.forEach((instance) => {
      uris.push(
        "https://api.bentley.com/issues/?iTwinId=" +
          instance.properties.ConnectedProjectGuid
      );
    });
    const issuesList = [];
    const details = [];
    getIssues(token, uris).then((data) => {
      data.forEach((item) => {
        const id = item.url.replace(
          "https://api.bentley.com/issues/?iTwinId=",
          ""
        );
        const issueData = item.data.issues;
        const detail = { id };
        const urls = [];
        const qq = issueData.map((a) => a.id);
        qq.forEach((q) => {
          urls.push("https://api.bentley.com/issues/" + q);
        });
        detail.urls = urls;
        details.push(detail);
        const issueOk = {
          id: id,
          stavba: issueData,
        };
        issuesList.push(issueOk);
      });
      getIssueDetails(token, details).then((data) => {
        data.forEach((e) => {
          let stavba = issuesList.find((f) => f.id == e.id);
          if (stavba) {
            stavba.stavba.forEach((s) => {
              let detail = e.data.find((f) => f.id == s.id);
              if (detail) {
                s.detail = detail.data.issue;
                delete s.detail.id;
              }
            });
          }
        });
        const type = req.query.type;
        if (type) {
          const ret = [];
          issuesList.forEach((issue) => {
            const typeData = issue.stavba.filter(
              (item) => item.type == type.trim()
            );
            if (typeData.length > 0) {
              typeData.forEach((e) => {
                ret.push(e);
              });
            }
          });
          res.send(ret);
          return;
        }
        res.send(issuesList);
      });
    });
  }).catch((error) => {
    res.status(500).send(error.message);
  });
});

//project members live
app.get("/membersLive", async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.send(res.status(400).send("Token is required"));
    return;
  }
  const prjId = req.query.id;
  if (!prjId) {
    res.send("Please provide project id");
    return;
  }
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const URI =
    "https://api.bentley.com/accesscontrol/itwins/" + prjId + "/members";
  axiosInstance
    .get(URI)
    .then((response) => {
      res.send(response.data);
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
});

// My projects
app.get("/projects", async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.send(res.status(400).send("Token is required"));
    return;
  }
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const URI = "https://api.bentley.com/itwins/?subClass=Project";
  axiosInstance
    .get(URI)
    .then((response) => {
      const id = req.query.id;
      if (id) {
        const data = response.data.iTwins.filter((f) => f.id == id);
        res.send(data);
      } else {
        res.send(response.data);
      }
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
});

async function getMemberProjects(token, urls) {
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const requests = urls.map((url) => axiosInstance.get(url));
  try {
    const results = await Promise.allSettled(requests);
    const validResponses = results
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return { url: urls[index], data: result.value.data };
        }
        return null;
      })
      .filter((response) => response !== null);
    return validResponses;
  } catch (error) {
    console.log(error);
  }
}

app.get("/memberProjects", async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.send(res.status(400).send("Token is required"));
    return;
  }
  const id = req.query.id;
  if (!token) {
    res.send(res.status(400).send("Member id is required"));
    return;
  }
  const axiosInstance = axios.create({
    headers: {
      "Access-Control-Allow-Origin": "*",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const URI = "https://api.bentley.com/itwins/?subClass=Project";
  axiosInstance
    .get(URI)
    .then((response) => {
      const data = response.data.iTwins;
      const projects = [];
      data.forEach((item) => {
        projects.push(
          "https://api.bentley.com/accesscontrol/itwins/" + item.id + "/members"
        );
      });
      getMemberProjects(token, projects).then((data) => {
        const ret = [];
        let member = null;
        data.forEach((e) => {
          const test = e.data.members.find((f) => f.id == id);
          if (test) {
            if (!member) {
              member = test;
            }
            let prjId = e.url.replace(
              "https://api.bentley.com/accesscontrol/itwins/",
              ""
            );
            prjId = prjId.replace("/members", "");
            {
              ret.push({ id: prjId });
            }
          }
        });
        if (member) {
          member.projects = ret;
          res.send(member);
        } else {
          res.send("No projects found");
        }
      });
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
});

app.listen(PORT, () => {
  console.log("server is running on " + PORT);
});