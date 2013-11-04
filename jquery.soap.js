/*==========================
jquery.soap.js  http://plugins.jquery.com/soap/ or https://github.com/doedje/jquery.soap
version: 1.2.1

jQuery plugin for communicating with a web service using SOAP.

Dependencies
------------
jQuery -- built and tested with v1.9.1 and v1.10.1, MAY work back to v1.6

Authors / History
-----------------

2013-06 >> fix for SOAPServer and SOAPAction headers, better params object to SOAPObject function
Remy Blom == www.hku.nl == remy.blom@kmt.hku.nl
Utrecht School of Arts,The Netherlands

2013-03 >> update internal OO structure, enable XML & object input as well as JSON
Zach Shelton == zachofalltrades.net
https://github.com/zachofalltrades/jquery.soap

2013-02-19 >> published to plugins.jquery.com/soap/
Remy Blom == https://github.com/doedje/jquery.soap

2011-10-31 >> fix handling of arrays in JSON paramaters
Diccon Towns == dtowns@reapit.com

2009-12-03 >> wrap jqSOAPClient as plugin
Remy Blom == www.hku.nl == remy.blom@kmt.hku.nl
Utrecht School of Arts,The Netherlands

2007-12-20 >> jqSOAPClient.beta.js by proton17
http://archive.plugins.jquery.com/project/jqSOAPClient

License
-------

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

I may consider permitting uses outside of the license terms on a by-case basis.

USAGE
-----

options {
	url: 'http://my.server.com/soapservices/',		//endpoint address for the service
	method: 'helloWorld',							// service operation name
													// 1) will be appended to url if appendMethodToURL=true
													// 2) will be used for request element name when building xml from JSON 'params' (unless 'elementName' is provided)
	appendMethodToURL: true,						// method name will be appended to URL defaults to true
	SOAPAction: 'action',							// manually set the Request Header 'SOAPAction', defaults to the method specified above (optional)
	soap12: false,									// use SOAP 1.2 namespace and HTTP headers - default to false
	soapConfig: {									// configuration  for soap envelop node element
		type: string,
		headers: string,
		customNS: {},
		prefix: string,
		namespace: string
	},

	//params can be XML DOM, XML String
	params: domXmlObject,							// XML DOM object
	params: xmlString,								// XML String for request

	// WS-Security
	wss: {
		username: 'user',
		password: 'pass',
		nonce: 'w08370jf7340qephufqp3r4',
		created: new Date().getTime()
	},

	//parameters from http://api.jquery.com/jQuery.ajax/
	async: boolean,
	headers: {},

	// debugging
	enableLogging: false						// to enable the local log function set to true, defaults to false (optional)
}

======================*/

(function($) {
	var enableLogging; // set by config/options
	var globalConfig = { //this setup once
		headers: {},
		async: false,
		soapConfig: {},
		appendMethodToURL: true,
		soap12: false,
		enableLogging: false
	};

	$.soap = function(options) {
		var config = {};

		//a configuration call will not have 'params' specified
		if (options && !options.params) {
			$.extend(globalConfig, options);//update global config
			return;
		}

		$.extend(config, globalConfig, options);
		enableLogging = config.enableLogging;// function log will only work below this line!

		//a configuration Soap
		$.extend(SOAPTool.settings, !!config.soap12 ? SOAP12 : SOAP11, globalConfig.soapConfig);
		if ($.type(options.soapConfig) === 'object') {
			$.extend(SOAPTool.settings, options.soapConfig);
		}
		log(config);
		log(SOAPTool.settings);

		SOAPTool.startEnvelope();
		SOAPTool.pushHeaders(config.wss);
		SOAPTool.pushBody(config.params);
		SOAPTool.endEnvelope();

		if (!!config.url) {//we have a request and somewhere to send it
			var url = config.url;
			if(config.appendMethodToURL && !!config.method){
				url += config.method;
			}
			if (!config.soap12) {
				config.headers["SOAPAction"] = config.SOAPAction || config.method;
			}

			return SOAPTool.send({
				url: url,
				async: config.async,
				headers: config.headers
			});
		}
	};

	var SOAP11 = {
		type: "text/xml",
		headers: "",
		customNS: {},
		prefix: "SOAP-ENV",
		namespace: "http://schemas.xmlsoap.org/soap/envelope/"
	},
	SOAP12 = {
		type: "application/soap+xml",
		headers: "",
		customNS: {},
		prefix: "env",
		namespace: "http://www.w3.org/2003/05/soap-envelope"
	},
	WSSconst = {
		security: "wsse:Security",
		securityNS: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
		usernameToken: "wsse:UsernameToken",
		usernameTokenNS: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
		usernameNode: "wsse:Username",
		usernameType: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
		passwordNode: "wsse:Password",
		passwordType: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText",
		nonceNode: "wsse:Nonce",
		nonceType: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd",
		wsuCreated: "wsu:Created",
		wsuCreatedType: "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
	};

	//Singleton SOAP Tool
	var SOAPTool=(function(){
		var _self = {
			xml: [],
			settings: {},
			startEnvelope: function () {
				var prefix = this.settings.prefix,
					namespace = this.settings.namespace,
					customNS = this.settings.customNS;
				this.xml = ["<", prefix, ":Envelope xmlns:", prefix, "=\"", namespace, "\" "];
				for (var ns in customNS) {
					if (customNS.hasOwnProperty(ns)) {
						this.xml.push(ns, "=\"", customNS[ns], "\" ");
					}
				}
				this.xml.push(">");
			},
			endEnvelope: function () {
				var prefix = this.settings.prefix;
				this.xml.push("</", prefix, ":Envelope>");
			},
			pushHeaders: function (wss) {
				var boolWSS = (!!wss && !!wss.username && !!wss.password),
					prefix = this.settings.prefix;
				if (boolWSS || this.settings.headers) {
					this.xml.push("<", prefix, ":Header>", (this.settings.headers || ""));
					if (boolWSS) {
						// var wss = WSSconst; // wss already defined (parameter)
						$.extend(wss, WSSconst);

						this.xml.push("<", wss.security, " ", "xmlns:wsse", "=\"", wss.securityNS, "\">");
						this.xml.push("<", wss.usernameToken, " ", "xmlns:wsu", "=\"", wss.usernameTokenNS, "\">");
						this.xml.push("<", wss.usernameNode, " ", "Type", "=\"", wss.usernameType, "\">", wss.username, "</", wss.usernameNode, ">");
						this.xml.push("<", wss.passwordNode, " ", "Type", "=\"", wss.passwordType, "\">", wss.password, "</", wss.passwordNode, ">");
						if (wss.nonce) {
							this.xml.push("<", wss.nonceNode, " ", "Type", "=\"", wss.nonceType, "\">", wss.nonce, "</", wss.nonceNode, ">");
						}
						if (wss.created) {
							this.xml.push("<", wss.wsuCreated, " ", "Type", "=\"", wss.wsuCreatedType, "\">", wss.created, "</", wss.wsuCreated, ">");
						}
						this.xml.push("</", wss.usernameToken, ">");
						this.xml.push("</", wss.security, ">");
					}
					this.xml.push("</", prefix, ":Header>");
				}
			},
			pushBody: function (xml) {
				var prefix = this.settings.prefix;
				this.xml.push("<", prefix, ":Body>", $.isXMLDoc(xml) ? this.dom2String(xml) : xml, "</", prefix, ":Body>");
			},
			send: function (config, success, error) {
				$.extend(config, {
					type: "POST",
					dataType: "xml",
					processData: false,
					data: this.xml.join(""),
					contentType: this.settings.type + "; charset=UTF-8"
				});
				return $.ajax(config);
			},
			dom2string: function(dom) {
				if (window.XMLSerializer) {
					return new window.XMLSerializer().serializeToString(dom);
				} else {
					return dom.xml;
				}
			}
		};
		return _self;
	})();

	function log(x) {
		if (enableLogging && typeof(console)==='object') {
			if ($.isFunction(console.log)) {
				console.log(x);
			}
		}
	}

})(jQuery);