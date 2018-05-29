'use strict';

const Hapi = require('hapi');
const parseUrl = require("parse-url");
const axios = require("axios");
const orgId = "541000";

const server = Hapi.server({
    port: 3000,
    host: 'localhost'
});

const basicParam = "?for_cv2=true&take=1";

const basicParamCV1 = "?for_cv2=false&take=1";

const baseUrl = "http://ruanr-7w3:2424";
// const compareUrl = "http://e2e2cv2intws.moodys.com";
const compareUrl = "http://ruanr-7w3:2424";
const isFilter = false;
var selFilter = "type";
const isTypeSelect = selFilter === "type";

const compareFilterlength = ([base, compare]) => {
    if (base.data && compare.data) {
        return base.data.region_filters.list.length === compare.data.region_filters.list.length
            && base.data.research_type_filters.list.length === compare.data.research_type_filters.list.length
            && base.data.series_filters.list.length === compare.data.series_filters.list.length
            && base.data.topic_filters.list.length === compare.data.topic_filters.list.length;
    }
    return false;
} 

const compareDatalength = ([base, compare]) => {
    if (base.data && compare.data) {
        return base.data.list.length === compare.data.list.length;
    }
    return false;
}

const compareDataWithMultiple = (results, allUrls, t) => {
    var res = "";
    var singleUrls = "";
    var sum = 0;
    var mul = 0;
    for (let i = 0; i < allUrls.length; i++) {
        const url = allUrls[i];
        const resl = results[i];
        if (url.includes("m=1")) {
            mul = resl.data._total_count;
            if ((mul !== sum && t) || mul < sum) {
                res += `${singleUrls} <br /> ${url} <div style="color: red;">error-> ${mul} : ${sum}</div> <br />`;
            }
            singleUrls = "";
            sum = 0;
        } else {
            if (t) {
                sum += resl.data._total_count;
            } else {
                sum = Math.max(sum, resl.data._total_count);
            }
            
            singleUrls += `${url} <br /> <div style="color: green;">${resl.data._total_count}</div> <br />`;
        }
    }
    return res;
}

const selectFilterWhichMultiple = (mulFilter, { region_filters, research_type_filters, series_filters, topic_filters }) => {
    const index = 0;
    const result = {
        multiple: [],
        // topic: `&topic=${topic_filters.list[index].key}`,
        // region: `&region=${region_filters.list[index].key}`,
        // type: `&type=${research_type_filters.list[index].key}`,
        // series: `&series=${series_filters.list[index].key}`,
        topic: "",
        region: "",
        type: "",
        series: "",
        other: ""
    };
    switch (mulFilter) {
        case "region":
            result.other = result.topic + result.series + "&region=";
            result.multiple = region_filters;
            break;
        case "type":
            result.other = result.topic + result.series + result.region;
            result.multiple = research_type_filters;
            break;
        case "series":
            result.other = result.topic + result.region + "&series=";
            result.multiple = series_filters;
            break;
        case "topic":
            result.other = result.region + result.series + "&topic=";
            result.multiple = topic_filters;
            break;
    }
    return result;
}

const getAllUrlsPromise = (allFilters, withFilterUrl) => {
    const { region_filters, research_type_filters, series_filters, topic_filters } = allFilters;
    const index = 0;
    const urlsPromise = [];
    var multipleUrl = "";
    var multipleOptions = "";
    var multipleCategorys = "";
    const { multiple, other } = selectFilterWhichMultiple(selFilter, allFilters);
    if (!isTypeSelect) {
        multipleOptions = "(";
        multiple.list.forEach(m => {
            var otherUrl = `/research/v3/organizations/${orgId}/research/all${withFilterUrl}${basicParam}`;
            var singleUrl = compareUrl + otherUrl + other + m.key;
            urlsPromise.push(singleUrl);
            multipleOptions += m.key + "|";
        });
        multipleOptions = multipleOptions.substring(0, multipleOptions.length - 1) + ")";
    } else {
        multiple.list.forEach(m => {
            var otherUrl = `/research/v3/organizations/${orgId}/research/all${withFilterUrl}${basicParam}`;
            var singleUrl = compareUrl + otherUrl + other + m.key;
            multipleOptions += m.key + ":";
            m.child_filters.list.forEach(j => {
                otherUrl = `/research/v3/organizations/${orgId}/research/${m.key}${withFilterUrl}${basicParam}&type=${j.key}`;
                singleUrl = compareUrl + otherUrl + other;
                urlsPromise.push(singleUrl);
                multipleOptions += j.key + "|";
            });
            multipleCategorys += m.key + "|";
            multipleOptions = multipleOptions.substring(0, multipleOptions.length - 1) + ",";
        });
        multipleCategorys = multipleCategorys.substring(0, multipleCategorys.length - 1);
        multipleOptions = multipleOptions.substring(0, multipleOptions.length - 1);
    }
    if (isTypeSelect) {
        urlsPromise.unshift(`${baseUrl}/research/v3/organizations/${orgId}/research/${multipleCategorys}${withFilterUrl}${basicParam}${other}&type=${multipleOptions}`);
    } else {
        urlsPromise.unshift(`${baseUrl}/research/v3/organizations/${orgId}/research/all${withFilterUrl}${basicParam}${other + multipleOptions}`);
    }
    return urlsPromise;
}

const getNewFilterResult = (obj) => {
    return {
        region: takeKeysList(obj.data.region_filters),
        topic: takeKeysList(obj.data.topic_filters),
        series: takeKeysList(obj.data.series_filters),
        type: takeKeysList(obj.data.research_type_filters)
    }
}

const getNewDResult = (obj) => {
    return obj.data.list.map((o) => {
        return o.doc_id
    })
}

const takeKeysList = (data) => {
    return data.list.map(el => {
        return el.key;
    });
}

const takeDocIdList = (data) => {
    return data.list.map(el => {
        return el.doc_id;
    });
}

const makeUrlFilterInfo = (url, obj, idx) => {
    var result = "";
    result += url + `<br /><div style="color: green;">`;
    result += `region: ${takeKeysList(obj.data.region_filters)}<br />`;
    result += `topic: ${takeKeysList(obj.data.topic_filters)}<br />`;
    result += `series: ${takeKeysList(obj.data.series_filters)}<br />`;
    result += `type: ${takeKeysList(obj.data.research_type_filters)}<br />`;
    result += "</div><br />";
    return result;
}

const getOldFilterResultCompareNew = (url, obj, mulFilterObj) => {
    const regionStr = takeKeysList(obj.data.region_filters).filter((el) => {
        return !mulFilterObj.region.includes(el);
    });
    const typeStr = takeKeysList(obj.data.research_type_filters).filter((el) => {
        return !mulFilterObj.type.includes(el);
    });
    const SeriesStr = takeKeysList(obj.data.series_filters).filter((el) => {
        return !mulFilterObj.series.includes(el);
    });
    const topicStr = takeKeysList(obj.data.topic_filters).filter((el) => {
        return !mulFilterObj.topic.includes(el);
    });
    var result = "";
    if (regionStr.length > 0
        && typeStr.length > 0
        && SeriesStr.length > 0
        && topicStr.length > 0) {
        result += url + `<br /><div style="color: red;">`;
        result += `region: ${regionStr.join()}<br />`;
        result += `topic: ${topicStr.join()}<br />`;
        result += `series: ${SeriesStr.join()}<br />`;
        result += `type: ${typeStr.join()}<br />`;
        result += "</div><br />";
    }
    return result;
}

const compareMutipleFilters = (promises, allUrls) => {
    const results = [];
    var newFilters = {};
    for (let i = 0; i < allUrls.length; i++) {
        if (i === 0) {
            newFilters = getNewFilterResult(promises[i]);
        } else {
            const info = getOldFilterResultCompareNew(allUrls[i], promises[i], newFilters);
            if (info !== "") {
                results.push(info);
            }
        }
    }
    const hasUnMatch = results.length > 0;
    return hasUnMatch ? results.join(): `${allUrls.join("<br />")}<br />success!`;
}

const getOldDocumentResultCompareNew = (url, obj, mulFilterObj) => {
    const docStr = takeDocIdList(obj.data).filter((el) => {
        return !mulFilterObj.includes(el);
    });
    var result = "";
    if (docStr.length > 0) {
        result += `<br />${url}<br /><div style="color: red;">`;
        result += `missing doc id: ${docStr.join()}<br />`;
        result += "</div><br />";
    }
    return result;
}

const compareMultipleDocuments = (promises, allUrls) => {
    const results = [];
    var mulFilterObj = {};
    for (let i = 0; i < allUrls.length; i++) {
        if (i === 0) {
            mulFilterObj = getNewDResult(promises[i]);
            results.push(`${allUrls[0]}<br />${mulFilterObj.join()}`);
        } else {
            const info = getOldDocumentResultCompareNew(allUrls[i], promises[i], mulFilterObj);
            if (info !== "") {
                results.push(info);
            }
        }
    }
    return results.length === 0 ? `${allUrls.join("<br />")}<br />success!`: results.join();
}

const mapTypeKey = (key) => {
    const categoryMapping = {
        "all": "All",
        "issuer_research": "Issuer",
        "methodology": "Methodology",
        "ratings_news": "Ratings-News",
        "data_reports": "Data-Reports",
        "industry_-_sector_research": "Industry-Sector",
        "research_news": "Research-News",
        "compliance": "Compliance"
    };
    return categoryMapping[key];
}

const handleMultipleUrls = ({ region_filters, research_type_filters, series_filters, topic_filters }, withFilterUrl) => {
    const typeList = [...research_type_filters.list];
    const allUrls = [];
    typeList.forEach(type => {
        var multipleUrl = `/research/v3/organizations/${orgId}/research/${mapTypeKey(type.key.toLowerCase())}${withFilterUrl}${basicParam}`;
        var multipleType = "&m=1&type=";
        if (type.child_filters) {
            type.child_filters.list.forEach(j => {
                multipleType += `${j.key}|`;
                var otherUrl = `/research/v3/organizations/${orgId}/research/${mapTypeKey(type.key.toLowerCase())}${withFilterUrl}${basicParamCV1}&type=${j.key}`;
                allUrls.push(otherUrl);
            });
            // var typeIdx = 0;
            // var typeKey = type.child_filters.list[typeIdx].key;
            // multipleType += typeKey + `&${selFilter}=(`;
            // const dataList = {
            //     "region": region_filters.list,
            //     "series": series_filters.list,
            //     "topic": topic_filters.list
            // }

            // dataList[selFilter].forEach(j => {
            //     multipleType += `${j.key}|`;
            //     var otherUrl = `/research/v3/organizations/${orgId}/research/${mapTypeKey(type.key.toLowerCase())}${withFilterUrl}${basicParamCV1}&type=${typeKey}&series=${j.key}`;
            //     allUrls.push(otherUrl);
            // })

            multipleType = multipleType.substring(0, multipleType.length - 1) + ")";
            multipleUrl += multipleType;
            allUrls.push(multipleUrl);
        }
    });
    return allUrls
}

const handleUrls = ({ region_filters, research_type_filters, series_filters, topic_filters }, withFilterUrl) => {
    const typeList = [{ key: "all" }, ...research_type_filters.list];
    const allUrls = [];
    typeList.forEach(type => {
        var otherUrl = `/research/v3/organizations/${orgId}/research/${mapTypeKey(type.key.toLowerCase())}${withFilterUrl}${basicParam}`;
        if (type.child_filters) {
            type.child_filters.list.forEach(j => {
                otherUrl = `/research/v3/organizations/${orgId}/research/${mapTypeKey(type.key.toLowerCase())}${withFilterUrl}${basicParam}&type=${j.key}`;
                allUrls.push(otherUrl)
            });
        } else {
            allUrls.push(otherUrl)
        }
        // region_filters.list.forEach(region => {
        //     series_filters.list.forEach(series => {
        //         topic_filters.list.forEach(topic => {
        //             otherUrl += `&topic=${topic.key}&series=${series.key}&region=${region.key}`;
        //             allUrls.push(otherUrl)
        //         });
        //     });
        // });
        
    });
    return allUrls;
};

async function takeSamplesUrls(isFilter, handle) {
    var withFilterUrl = "";
    if (isFilter) {
        withFilterUrl = "/filter"
    }
    var allUrl = `${baseUrl}/research/v3/organizations/${orgId}/research/all/filter${basicParam}`;
    return new Promise(res => {
        axios.get(allUrl).then((alldata) => {
            res(handle(alldata.data, withFilterUrl));
        });
    });
}

const oneToOneCompare = (compareMethod) => (othUrls) => {
    return new Promise(resolve => {
        Promise.all([
            axios.get(baseUrl + othUrls),
            axios.get(compareUrl + othUrls)
        ]).then((result) => {
            var res = "";
            if (compareMethod(result)) {
                res = `${baseUrl + othUrls}  ${compareUrl + othUrls} <div style="color: green;">success</div>  <br />`;
            } else {
                res = `${baseUrl + othUrls}  ${compareUrl + othUrls} <div style="color: red;">error</div> <br />`;
            }
            resolve(res);
        });
    })
}

const onToMany = (method) => (allUrls, mIdx) => {
    return new Promise(resolve => {
        Promise.all([
            axios.get(baseUrl + othUrls),
            axios.get(compareUrl + othUrls)
        ]).then((result) => {
            var res = "";
            if (compareMethod(result)) {
                res = `${baseUrl + othUrls}  ${compareUrl + othUrls} <div style="color: green;">success</div>  <br />`;
            } else {
                res = `${baseUrl + othUrls}  ${compareUrl + othUrls} <div style="color: red;">error</div> <br />`;
            }
            resolve(res);
        });
    })
}

async function go() {
    const compareMethod = isFilter ? compareFilterlength : compareDatalength;
    const allUrls = await takeSamplesUrls(isFilter, handleUrls);
    var result = "";
    for (let i = 0; i < (allUrls.length > 50 ? 50 : allUrls.length); i++) {
        result += await oneToOneCompare(compareMethod)(allUrls[i]);
    }
    return result;
}

async function goM() {
    const handle = compareDataWithMultiple;
    const allUrls = await takeSamplesUrls(isFilter, handleMultipleUrls);
    const result = await new Promise((resolve) => {
        const urlsPromise = [];
        allUrls.forEach(url => {
            if (!url.includes("m=1")) {
                urlsPromise.push(axios.get(compareUrl + url));
            } else {
                urlsPromise.push(axios.get(baseUrl + url));
            }
        });
        Promise.all(urlsPromise).then((results) => {
            resolve(handle(results, allUrls, isTypeSelect));
        });
    });
    return result;
}

async function goMultiple(filterOption) {
    selFilter = filterOption;
    const handle = isFilter ? compareMutipleFilters :compareMultipleDocuments;
    const allUrls = await takeSamplesUrls(isFilter, getAllUrlsPromise);
    const result = await new Promise((resolve) => {
        const urlsPromise = [];
        allUrls.forEach(url => {
            urlsPromise.push(axios.get(url));
        });
        Promise.all(urlsPromise).then((results) => {
            resolve(handle(results, allUrls));
        });
    });
    return JSON.stringify(result);
}

server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
        return go();
    }
});

server.route({
    method: 'GET',
    path: '/m',
    handler: (request, h) => {
        return goM();
    }
});

server.route({
    method: 'GET',
    path: '/{filter}',
    handler: (request, h) => {
        return goMultiple(request.params.filter);
    }
});

const init = async () => {
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});

init();