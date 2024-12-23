FROM tomcat:8.5-slim

RUN rm -rf /usr/local/tomcat/webapps/*

ADD https://repo1.maven.org/maven2/org/apache/geode/geode-pulse/1.0.0-incubating/geode-pulse-1.0.0-incubating.war /usr/local/tomcat/webapps/ROOT.war

COPY /files /
