# backend/controllers/__init__.py
from .auth import AuthController
from .datarooms import DataroomsController
from .folders import FoldersController
from .files import FilesController
from .search import SearchController
from .users import UsersController

def register_controllers(app):
    app.register_blueprint(AuthController().bp, url_prefix="/api/auth")
    app.register_blueprint(DataroomsController().bp, url_prefix="/api")
    app.register_blueprint(FoldersController().bp, url_prefix="/api")
    app.register_blueprint(FilesController().bp, url_prefix="/api")
    app.register_blueprint(SearchController().bp, url_prefix="/api/search")
    app.register_blueprint(UsersController().bp, url_prefix="/api/users")