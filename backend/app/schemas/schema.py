import strawberry
from app.schemas.queries import Query
from app.schemas.mutations import Mutation

schema = strawberry.Schema(query=Query, mutation=Mutation)
