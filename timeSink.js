var TimeSink = {};
TimeSink.historyViewer = (function () {
    var secondsToHuman, getHours, getMins, getSeconds, 
        doNextDay, doPrevDay, updateNavDate, showWorkingUI,
        nextDayButton, prevDayButton, list, header, dateLabel;
    
    secondsToHuman = function (val) {
        if (val < 60) {
            return val + " seconds";
        } else {
            return getHours(val) + getMins(val);
        }
    };

    getHours = function (val) {
        var hr = Math.floor(val / 3600);
        if (hr === 0) {
            return '';
        }
        return (hr === 1) ? "1 hour,  " : hr + ' hours, ';
    };

    getMins = function (val) {
        var min = Math.ceil((val % 3600) / 60);
        return (min === 1) ? " 1 minute" : min + " minutes"; 
    };

    doNextDay = function () {
        showWorkingUI();
        TimeSink.historyManager.getNextDayHistory();
    };

    doPrevDay = function () {
        showWorkingUI();
        TimeSink.historyManager.getPrevDayHistory();
    };

    showWorkingUI = function () {
        list.empty();
        header.text("Loading....");
    }

    updateNavDate = function () {
        var str, aDate = new Date(TimeSink.historyManager.currentStartTime);
        str =  (aDate.getMonth() + 1) + "/" + aDate.getDate() + "/" + aDate.getFullYear();
        dateLabel.text(str);
    };

    return {
        emptyHistory: function () {
            list.empty();
            updateNavDate();
            header.text("No browser history for this day");
        },
        drawHistory: function (parsedHistory) {
            var totalTime = 0; 
            updateNavDate();
            for (domain in parsedHistory) {
                if (parsedHistory.hasOwnProperty(domain)) {
                    list.append('<li><span class="domainName">' + 
                        domain + ':</span> about <span class="surfTime">' +
                        secondsToHuman(parsedHistory[domain].totalTime) + 
                        '</span></li>');
                    totalTime += parsedHistory[domain].totalTime;
                }
            }
            header.text("You spent about " + secondsToHuman(totalTime) + " surfing");
        },
        init: function () {
            list = jQuery('#histList');
            header = jQuery('#totalTime');
            dateLabel = jQuery('#dateLabel');
            nextDayButton = jQuery('#nextDayButton').click(doNextDay);
            prevDayButton = jQuery('#prevDayButton').click(doPrevDay);
        }
    };
}());

TimeSink.historyParser = (function () {
    var parsedHistory = {}, getDomainFromURL, grabVisitsToDomain, parseVisits, 
        handleNoItems, i,
        parseHistoryItem, calculateTimes, myCount = 0;

    handleNoItems = function () {
        TimeSink.historyViewer.emptyHistory();
    };

    parseHistoryItem = function (anItem) {
        var domainName = getDomainFromURL(anItem.url);
        if (!parsedHistory[domainName]) {
            parsedHistory[domainName] = {
                visitTimes: []
                , totalTime: 0
                , visits: []
            };
        }
        grabVisitsToURL(anItem.url);
    };

    getDomainFromURL = function (aURL) {
        var str, startPos;
        startPos = aURL.indexOf('//') + 2;
        str = aURL.substring(startPos, aURL.indexOf('/', startPos));
        return str;
    }

    grabVisitsToURL = function (aDomain) {
        chrome.history.getVisits({"url": aDomain}, function (visits) {
            parseVisits(getDomainFromURL(aDomain), visits);
        });
    };

    parseVisits = function (domainName, visits) {
        var i, visit;
        for (i = 0; i < visits.length; i += 1) {
           visit = visits[i];
           if (visit.visitTime >= TimeSink.historyManager.currentStartTime &&
               visit.visitTime <= TimeSink.historyManager.currentEndTime) {
               parsedHistory[domainName].visitTimes.push(visit.visitTime);
               parsedHistory[domainName].visits.push(visit);
           }
        }
        myCount -= 1;
        if (myCount === 0) {
            calculateTimes();
        }
    };

    calculateTimes = function () {
        var domain, i, visits, initialTime, nextTime, elapsedSeconds, 
            arbitraryTimespan = 10 * 60 * 1000;
        for (domain in parsedHistory) {
            if (parsedHistory.hasOwnProperty(domain)) {
                elapsedSeconds = 0; // reset
                visits = parsedHistory[domain].visitTimes; 
                visits.sort(function (a,b) {
                    return a - b;
                });
                if (visits.length === 1) {
                    elapsedSeconds = 30; // 30 seconds is an "average" time on a page
                } else {
                    initialTime = visits[0];
                    for (i = 0; i < visits.length; i += 1) {
                        if (i == visits.length - 1) {
                            elapsedSeconds += (Math.ceil((visits[i] - initialTime) / 1000) + 30);
                        } else {
                            nextTime = visits[i + 1];
                            if (nextTime - initialTime > arbitraryTimespan) {
                                elapsedSeconds += (Math.ceil((visits[i] - initialTime) / 1000) + 30);
                                initialTime = nextTime;
                            }
                        }
                    }
                }
                parsedHistory[domain].totalTime  = elapsedSeconds;
            }
        }
        TimeSink.historyViewer.drawHistory(parsedHistory);
    };

    return {
        handleHistorySearch: function (items) {
            if (!items || items.length === 0) {
                handleNoItems();
            } else {
                parsedHistory = {};
                myCount = items.length; // we will parse this many items...
                for (i = 0; i < items.length; i += 1) {
                   parseHistoryItem(items[i]);
                }
            }
        }
    }
}());

TimeSink.historyManager = (function () {
    // get history for a day
    var fullDay = (24 * 60 * 60 * 1000), currentDay;

    return {
        getHistoryForToday: function () {
            var today = new Date();
            today.setHours(0,0,0,1);
            this.getHistoryForDate(today);
        },
        getPrevDayHistory: function () {
            this.getHistoryForDate(new Date(currentDay.getTime() - fullDay));
        },
        getNextDayHistory: function () {
            this.getHistoryForDate(new Date(currentDay.getTime() + fullDay));
        },
        getHistoryForDate: function (aDate) {
            var startTime, endTime;
            currentDay = aDate;
            this.currentStartTime = aDate.getTime();
            this.currentEndTime = this.currentStartTime + fullDay;
            chrome.history.search({
                "text": ""
                ,"startTime": this.currentStartTime
                ,"endTime": this.currentEndTime
                ,"maxResults": 5000
            }, TimeSink.historyParser.handleHistorySearch);
        },
        currentStartTime: 0,
        currentEndTime: 0
    };

}());
jQuery(function () {
    TimeSink.historyViewer.init();
    TimeSink.historyManager.getHistoryForToday();
});
