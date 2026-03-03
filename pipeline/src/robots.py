import urllib.robotparser
from urllib.parse import urlparse

class RobotsChecker:
    def __init__(self, user_agent='AlohaHealthBot/1.0'):
        self.user_agent = user_agent
        self._cache = {}
    
    def _get_parser(self, base_url):
        parsed_url = urlparse(base_url)
        domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        if domain in self._cache:
            return self._cache[domain]
        
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(f"{domain}/robots.txt")
        
        try:
            parser.read()
        except:
            # Return permissive parser on any exception
            class PermissiveParser:
                def can_fetch(self, user_agent, url):
                    return True
            parser = PermissiveParser()
        
        self._cache[domain] = parser
        return parser
    
    def can_fetch(self, url):
        parsed_url = urlparse(url)
        base = f"{parsed_url.scheme}://{parsed_url.netloc}"
        parser = self._get_parser(base)
        return parser.can_fetch(self.user_agent, url)
