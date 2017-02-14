(function(){
  var isWordedPart = function(str) {
    // TODO - better regexes
    var wordRe = /^(([a-z]*?[aeiouy][a-z]*?)|(\d*)|q)$/i;
    var acronymRe = /^([a-z]{2,5}|[A-Z]{2,5})$/;
    var split = str.split(/-|\.|,|\+|_|%20/);

    for (var i = 0; i < split.length; i++) {
      if (!wordRe.test(split[i]) && !acronymRe.test(split[i])) {
        return false;
      }
    }

    return true;
  };

  var collapseAdjacentEllipsizedParams = function(str) {
    var originalStr = str;

    // TODO - combine/simplifiy
    var str = str.replace(/&\.\.\.&\.\.\.&/g, '&...&')
    var str = str.replace(/\.\.\.&\.\.\.&/g, '...&')
    var str = str.replace(/&\.\.\.&\.\.\./g, '&...')

    if (str.length === originalStr.length) {
      return str;
    } else {
      return collapseAdjacentEllipsizedParams(str);
    }
  };

  // TODO - combine with collapseAdjacentEllipsizedParams
  var collapseAdjacentEllipsizedPaths = function(str) {
    var originalStr = str;

    // TODO - combine/simplifiy
    var str = str.replace(/\/\.\.\.\/\.\.\.\//g, '/.../')
    var str = str.replace(/\.\.\.\/\.\.\.\//g, '.../')
    var str = str.replace(/\/\.\.\.\/\.\.\./g, '/...')

    if (str.length === originalStr.length) {
      return str;
    } else {
      return collapseAdjacentEllipsizedPaths(str);
    }
  };

  var shorteners = [
    // Remove protocol
    function(url) {
      return url.replace(/^https?\:\/?\/?/i, '');
    }
    ,
    // Remove www.
    function(url) {
      return url.replace(/^www\./, '');
    }
    ,
    // Remove port
    function(url) {
      var urlSlashSplit = url.split('/');
      var domain = urlSlashSplit[0];
      urlSlashSplit[0] = domain.split(':')[0];
      return urlSlashSplit.join('/');
    }
    ,
    // Remove non-human bits past the query
    function(url, maxLength) {
      var indexOfQuestionMark = url.indexOf('?');
      if (indexOfQuestionMark < 0) {
        return url;
      }

      var beforeQuery = url.substr(0, indexOfQuestionMark);
      var query = url.substr(indexOfQuestionMark + 1);

      var indexOfHash = query.indexOf('#');
      var hash = '';
      var queryBeforeHash = query;
      if (indexOfHash > -1) {
        var queryBeforeHash = query.substr(0, indexOfHash);
        var hash = query.substr(indexOfHash);
      }

      var queryParts = queryBeforeHash.split('&');
      for (var i = 0; i < queryParts.length; i++) {
        var paramPair = queryParts[i].split('=');

        // TODO - write simpler
        if (!isWordedPart(paramPair[0]) && (paramPair.length > 1 && !isWordedPart(paramPair[1]))) {
          queryParts[i] = '...';
        }

        // TODO - write simpler
        else if (!isWordedPart(paramPair[0]) && (paramPair.length > 1 && isWordedPart(paramPair[1]))) {
          queryParts[i] = '...=' + paramPair[1];
        }

        // TODO - write simpler
        else if (isWordedPart(paramPair[0]) && (paramPair.length > 1 && !isWordedPart(paramPair[1]))) {
          queryParts[i] = paramPair[0] + '=...';
        }
      }

      query = queryParts.join('&');
      return beforeQuery + '?' + collapseAdjacentEllipsizedParams(query) + hash;
    }
    ,
    // Remove non-human bits in path
    // TODO - treat file.ext differently than /paths/ between two /
    function(url, maxLength) {
      var indexOfSlash = url.indexOf('/');
      if (indexOfSlash < 0) {
        return url;
      }

      var beforeSlash = url.substr(0, indexOfSlash);
      var afterSlash = url.substr(indexOfSlash + 1);

      var indexOfQuery = afterSlash.indexOf('?');
      var indexOfHash = afterSlash.indexOf('#');

      var afterSlashSuffix = '';
      var afterSlashBeforeSuffix = afterSlash;
      if (indexOfQuery > -1 || indexOfHash > -1) {
        var indexOfSuffix = indexOfQuery !== -1 ? indexOfQuery : indexOfHash;
        if (indexOfQuery > -1 && indexOfHash > -1) {
          indexOfSuffix = indexOfQuery < indexOfHash ? indexOfQuery : indexOfHash;
        }
        afterSlashBeforeSuffix = afterSlash.substr(0, indexOfSuffix);
        afterSlashSuffix = afterSlash.substr(indexOfSuffix);
      }

      var pathParts = afterSlashBeforeSuffix.split('/')
      for (var i = 0; i < pathParts.length; i++) {
        if (!isWordedPart(pathParts[i])) {
          pathParts[i] = '...';
        }
      }

      afterSlash = pathParts.join('/');
      return beforeSlash + '/' + collapseAdjacentEllipsizedPaths(afterSlash) + afterSlashSuffix;
    }
    ,
    // Ellipsize domain parts
    function(url, maxLength) {
      var urlSlashSplit = url.split('/');
      var domain = urlSlashSplit[0];
      var domainParts = domain.split('.');
      var longestDomainPart = '';
      var longestDomainPartIndex = -1;
      var domainEllipsis = '[...]';

      for (var i = 0; i < domainParts.length; i++) {
        if (domainParts[i].length > longestDomainPart.length) {
          longestDomainPart = domainParts[i];
          longestDomainPartIndex = i;
        }
      }

      var domainMaxLength = maxLength - (url.length - longestDomainPart.length);
      if (url.length - longestDomainPart.length > domainMaxLength) {
        domainMaxLength = Math.max(domainMaxLength, url.length - longestDomainPart.length);
      }

      var newLongestDomainPart = longestDomainPart.substr(0, domainMaxLength - domainEllipsis.length);
      if (newLongestDomainPart === longestDomainPart) {
        return url;
      }

      domainParts[longestDomainPartIndex] = newLongestDomainPart + domainEllipsis;
      urlSlashSplit[0] = domainParts.join('.');
      return urlSlashSplit.join('/');
    }
    ,
    // Prioritize main domain and TLD over subdomains
    function(url, maxLength) {
      var urlSlashSplit = url.split('/');
      var domain = urlSlashSplit[0];
      var domainParts = domain.split('.');
      var ellipsis = '...';

      // Only treat subdomains
      if (domainParts.length < 3) {
        return url;
      }

      // Don’t run if domain has already been shortened
      if (urlSlashSplit[0].indexOf('[...]') > -1) {
        return url;
      }

      subDomainsPriorToMainDomain = domainParts.slice(0, domainParts.length - 2)
      subDomainsPriorToMainDomainStr = subDomainsPriorToMainDomain.join('.')

      domainAndTLD = domainParts.slice(domainParts.length - 2).join('.')

      //var subDomainMaxLength = maxLength - (url.length - subDomainsPriorToMainDomainStr.length) - 1; // TODO
      var subDomainMaxLength = maxLength - (url.length - subDomainsPriorToMainDomainStr.length) - 1; // TODO

      var newSubDomainsPriorToMainDomainStr = subDomainsPriorToMainDomainStr.substr(subDomainsPriorToMainDomainStr.length - (subDomainMaxLength - ellipsis.length));
      if (newSubDomainsPriorToMainDomainStr === subDomainsPriorToMainDomainStr) {
        return url;
      }

      urlSlashSplit[0] = '...' + newSubDomainsPriorToMainDomainStr + '.' + domainAndTLD;
      return urlSlashSplit.join('/');
    }
    ,
    // Merge ellipsies
    function(url) {
      return url.replace(/(\.){3,}/g, '...');
    }
    ,
    // Finally, just ellipsize
    function(url, maxLength) {
      var url = url.substr(0, maxLength - 3) + '...';
      url = url.replace(/(\.){3,}/g, '...');
      url = url.replace(/\[\.\.\.\]\.\.\.$/g, '...'); // TODO - be smarter
      url = url.replace(/\[\.\.\.$/g, '...'); // TODO - be smarter
      url = url.replace(/(\.){3,}/g, '...'); // TODO - necessary?
      return url;
    }
  ];

  var responsiveURL = function(url, maxLength) {
    for (var i = 0; i < shorteners.length; i++) {
      if (url.length > maxLength) {
        url = shorteners[i](url, maxLength);
      }
    }

    return url;
  };

  window.ResponsiveURL = {
    init: responsiveURL
  };
})();
