{-# LANGUAGE QuasiQuotes, TypeFamilies, GeneralizedNewtypeDeriving #-}
module Model where

import Yesod
import Database.Persist.TH (share2)
import Database.Persist.GenericSql (mkMigrate)

import Data.Text (Text)

-- You can define all of your database entities here. You can find more
-- information on persistent and how to declare entities at:
-- http://docs.yesodweb.com/book/persistent/
share2 mkPersist (mkMigrate "migrateAll") [$persist|
User
    ident String
    password String Maybe Update
    nick String Update
    color String Update
    UniqueUser ident
Email
    email String
    user UserId Maybe Update
    verkey String Maybe Update
    UniqueEmail email
Command
    user UserId Eq
    name String Eq
    command String
    UniqueCommand user name
Var
    user UserId Eq
    name String Eq
    value String Eq
    UniqueVar user name
Note
    user UserId Eq
    name String Eq Asc Update
    text Text Update
    public Bool Eq Update
    UniqueNote user name
|]
